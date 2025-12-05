import InvestmentPlans from '../InvestmentPlans';

// todo: remove mock functionality
const mockPlans = [
  {
    id: '1',
    name: 'Monthly DCA Strategy',
    amount: 500,
    frequency: 'monthly' as const,
    nextContribution: 'Nov 15, 2025',
    autoInvest: true,
  },
  {
    id: '2',
    name: 'Weekly Accumulation',
    amount: 100,
    frequency: 'weekly' as const,
    nextContribution: 'Nov 12, 2025',
    autoInvest: true,
  },
  {
    id: '3',
    name: 'Savings Plan',
    amount: 250,
    frequency: 'monthly' as const,
    nextContribution: 'Dec 1, 2025',
    autoInvest: false,
  },
];

export default function InvestmentPlansExample() {
  return <InvestmentPlans plans={mockPlans} />;
}
