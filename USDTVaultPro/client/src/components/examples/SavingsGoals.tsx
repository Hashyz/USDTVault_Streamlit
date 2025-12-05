import SavingsGoals from '../SavingsGoals';

// todo: remove mock functionality
const mockGoals = [
  {
    id: '1',
    title: 'Emergency Fund',
    current: 8500,
    target: 10000,
    deadline: 'Dec 31, 2025',
  },
  {
    id: '2',
    title: 'Investment Portfolio',
    current: 5200,
    target: 15000,
    deadline: 'Jun 30, 2026',
  },
  {
    id: '3',
    title: 'Vacation Savings',
    current: 2100,
    target: 5000,
    deadline: 'Aug 15, 2025',
  },
];

export default function SavingsGoalsExample() {
  return <SavingsGoals goals={mockGoals} onDeposit={(goalId) => console.log('Deposit to goal:', goalId)} />;
}
