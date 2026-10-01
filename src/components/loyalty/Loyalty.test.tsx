/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  blockedRewardsFixture,
  ivendSummaryFixture,
  loyaltyHistoryFixture,
  loyaltyRedeemedFixture,
  loyaltyReferralFixture,
  loyaltyRewardFixture,
  loyaltyRewardsFixture,
  loyaltySummaryFixture,
} from '@/test/loyalty-fixtures';
import { LoyaltyNav } from './LoyaltyNav';
import { LoyaltySummaryView } from './LoyaltySummaryView';
import { PointsHistory } from './PointsHistory';
import { RedeemReward } from './RedeemReward';
import { ReferralView } from './ReferralView';
import { RewardCard } from './RewardCard';
import { RewardsList } from './RewardsList';

describe('loyalty summary (as the backend wrote it)', () => {
  it('El Dokan: points, Gold level, pending and expiring texts (EN + AR)', () => {
    const { unmount } = render(<LoyaltySummaryView locale="en" summary={loyaltySummaryFixture('en')} />);
    expect(screen.getByTestId('loyalty-summary')).toHaveAttribute('data-provider', 'elDokan');
    expect(screen.getByTestId('loyalty-points')).toHaveTextContent('1,000 points');
    expect(screen.getByTestId('loyalty-tier')).toHaveTextContent('Spend 300 EGP more to become a Gold member.');
    expect(screen.getByTestId('loyalty-pending')).toHaveTextContent('80 points will be ready to use soon.');
    expect(screen.getByTestId('loyalty-expiring')).toHaveTextContent('300 points expire on 31 Dec 2026.');
    expect(screen.queryByTestId('loyalty-value')).toBeNull();
    unmount();

    render(<LoyaltySummaryView locale="ar" summary={loyaltySummaryFixture('ar')} />);
    expect(screen.getByTestId('loyalty-points')).toHaveTextContent('1,000 نقطة');
    expect(screen.getByText('رصيدك')).toBeInTheDocument();
  });

  it('iVend: the value and store credit are Money from the backend', () => {
    render(<LoyaltySummaryView locale="en" summary={ivendSummaryFixture('en')} />);
    expect(screen.getByTestId('loyalty-value')).toHaveTextContent('100 EGP');
    expect(screen.getByTestId('loyalty-credit')).toHaveTextContent('25.5 EGP');
    expect(screen.queryByTestId('loyalty-tier')).toBeNull();
  });

  it('links only the pages the backend says exist', () => {
    const { unmount } = render(<LoyaltyNav locale="en" sections={loyaltySummaryFixture('en').sections} current="rewards" />);
    const nav = screen.getByTestId('loyalty-nav');
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/en/account/your-points',
      '/en/account/vouchers',
      '/en/account/history',
      '/en/account/get-free-points',
    ]);
    expect(within(nav).getByRole('link', { name: 'Rewards' })).toHaveAttribute('aria-current', 'page');
    unmount();

    // iVend: points only → no nav at all
    const { container } = render(<LoyaltyNav locale="en" sections={ivendSummaryFixture('en').sections} current="points" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('rewards', () => {
  it('shows each reward with its cost and, when it cannot be redeemed, the backend reason', () => {
    render(<RewardsList locale="en" rewards={loyaltyRewardsFixture('en')} />);
    const rewards = screen.getAllByTestId('reward');
    expect(rewards.map((reward) => reward.getAttribute('data-can-redeem'))).toEqual(['true', 'true', 'false', 'false']);
    expect(within(rewards[0]).getByTestId('reward-cost')).toHaveTextContent('500 points');
    expect(within(rewards[0]).getByText('50 EGP off', { selector: 'p' })).toBeInTheDocument();
    expect(within(rewards[2]).getByTestId('reward-reason')).toHaveTextContent('For Gold members only.');
    expect(within(rewards[3]).getByTestId('reward-reason')).toHaveTextContent('You need 1,000 points more.');
    expect(screen.getByRole('link', { name: 'View reward: 10% off' })).toHaveAttribute('href', '/en/account/vouchers/4');
    expect(screen.queryByTestId('loyalty-blocker')).toBeNull();
  });

  it('shows the blocker and the page that clears it (AR)', () => {
    render(<RewardsList locale="ar" rewards={blockedRewardsFixture('ar')} />);
    const blocker = screen.getByTestId('loyalty-blocker');
    expect(blocker).toHaveTextContent('وثّق رقم هاتفك لاستبدال المكافآت.');
    expect(within(blocker).getByRole('link', { name: 'توثيق رقم هاتفي' })).toHaveAttribute('href', '/ar/verify-phone');
  });

  it('draws the redeem button only where the backend allows it', () => {
    const { unmount } = render(<RedeemReward locale="en" rewardId="6" canRedeem={false} redeemAction={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Redeem' })).toBeNull();
    unmount();
    render(<RewardCard locale="en" reward={loyaltyRewardFixture('en').reward} detailed />);
    expect(screen.getByRole('heading', { level: 2, name: '50 EGP off' })).toBeInTheDocument();
  });

  it('redeems and shows the voucher code and the points left', async () => {
    const redeemed = loyaltyRedeemedFixture('en');
    const action = vi.fn(async () => ({ ok: true as const, redemption: redeemed.redemption, points: redeemed.points }));
    render(<RedeemReward locale="en" rewardId="3" canRedeem redeemAction={action} timeZone="Africa/Cairo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));
    await waitFor(() => expect(screen.getByTestId('redemption')).toBeInTheDocument());
    expect(action).toHaveBeenCalledWith('en', '3');
    expect(screen.getByTestId('redemption-code')).toHaveTextContent(redeemed.redemption.code!);
    expect(screen.getByTestId('redemption-points')).toHaveTextContent('Points left: 500 points');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows the backend reason when redeeming is refused', async () => {
    const action = vi.fn(async () => ({ ok: false as const, message: 'You need 300 points more.' }));
    render(<RedeemReward locale="en" rewardId="4" canRedeem redeemAction={action} />);
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));
    expect(await screen.findByTestId('redeem-error')).toHaveTextContent('You need 300 points more.');
  });
});

describe('points history', () => {
  it('lists the entries newest first with signed points and links the order', () => {
    render(<PointsHistory locale="en" page={loyaltyHistoryFixture('en')} timeZone="Africa/Cairo" />);
    const entries = screen.getAllByTestId('history-entry');
    expect(entries.map((entry) => entry.getAttribute('data-kind'))).toEqual(['pending', 'used', 'referral', 'earned', 'expired']);
    expect(entries[1]).toHaveTextContent('-500 points');
    expect(entries[3]).toHaveTextContent('+120 points');
    expect(within(entries[0]).getByText('Available from 12 Oct 2026')).toBeInTheDocument();
    expect(within(entries[3]).getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en/account/orders/mock-order-48200');
  });

  it('says when there is nothing yet (AR)', () => {
    render(<PointsHistory locale="ar" page={{ items: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 } }} />);
    expect(screen.getByTestId('history-empty')).toHaveTextContent('لا يوجد شيء هنا بعد.');
  });
});

describe('referral', () => {
  it('shows the code, how it works, and copies the code or the invite text', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ReferralView locale="en" referral={loyaltyReferralFixture('en')} />);
    expect(screen.getByTestId('referral-code')).toHaveTextContent('MONA50');
    expect(screen.getByTestId('referral-message')).toHaveTextContent('you both get 50 points');
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite text' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Use my code MONA50 at Seif Pharmacies.'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
