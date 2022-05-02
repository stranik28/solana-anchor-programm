use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::rent;
use anchor_lang::solana_program::system_instruction;

declare_id!("ESAXaQuTVApRKEVhgNPd3EnLgH7fNQhLRSu9pP5CJZ23");

#[program]
pub mod donation {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let donation = &mut ctx.accounts.donation;
        donation.authority = authority;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let rent_exempt = rent::Rent::get()?.minimum_balance(DonationBank::LEN);

        let bank = ctx.accounts.donation_bank.to_account_info();
        let amount = bank.try_lamports()?.saturating_sub(rent_exempt);

        require!(amount > 0, DonationError::NoFundsForWithdrawal);

        **bank.try_borrow_mut_lamports()? = rent_exempt;
        let destination = ctx.accounts.destination.to_account_info();
        **destination.try_borrow_mut_lamports()? =
            destination
                .lamports()
                .checked_add(amount)
                .ok_or_else(|| error!(DonationError::CalculationFailure))?;

        emit!(WithdrawEvent {
            donation_bank: ctx.accounts.donation_bank.key(),
            destination: ctx.accounts.destination.key(),
            amount,
        });

        Ok(())
    }

    pub fn make_donation(ctx: Context<MakeDonation>, amount: u64) -> Result<()> {
        require!(amount > 0, DonationError::InvalidAmount);
        
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.donor.key(),
                &ctx.accounts.donation_bank.key(),
                amount,
            ),
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.donation_bank.to_account_info(),
            ],
        )
        .map_err(Into::<error::Error>::into)?;

        let registry = &mut ctx.accounts.registry;
        if registry.amount == 0 {
            registry.donor = ctx.accounts.donor.key();
            registry.donation_bank = ctx.accounts.donation_bank.key();
        }

        registry.amount = registry.amount.saturating_add(amount);

        emit!(DonationEvent {
            donation_bank: ctx.accounts.donation_bank.key(),
            donor: ctx.accounts.donor.key(),
            amount,
        });

        Ok(())
    }
}

#[event]
pub struct DonationEvent {
    pub donation_bank: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WithdrawEvent {
    pub donation_bank: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = DonationBank::LEN, seeds = [authority.as_ref()], bump)]
    pub donation: Account<'info, DonationBank>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MakeDonation<'info> {
    #[account(mut)]
    pub donation_bank: Account<'info, DonationBank>,
    #[account(init_if_needed, payer = donor, seeds = [donation_bank.key().as_ref(), donor.key().as_ref()], bump)]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum DonationError {
    #[msg("amount should be more than zero")]
    InvalidAmount,
    #[msg("Calculation failed due to overflow error")]
    CalculationFailure,
    #[msg("The donation is empty")]
    NoFundsForWithdrawal,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = authority)]
    pub donation_bank: Account<'info, DonationBank>,
    pub authority: Signer<'info>,
    #[account(mut, rent_exempt = enforce)]
    pub destination: UncheckedAccount<'info>,
}

#[account]
pub struct DonationBank {
    pub authority: Pubkey,
}

impl DonationBank {
    const LEN: usize = 32 + 8;
}

#[account]
#[derive(Default)]
pub struct Registry {
    pub donation_bank: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}




