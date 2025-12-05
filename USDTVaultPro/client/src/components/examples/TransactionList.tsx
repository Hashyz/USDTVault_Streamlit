import TransactionList from '../TransactionList';

// todo: remove mock functionality
const mockTransactions = [
  {
    id: '1',
    type: 'receive' as const,
    amount: 500,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    timestamp: '2 hours ago',
    status: 'completed' as const,
  },
  {
    id: '2',
    type: 'send' as const,
    amount: 250,
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    timestamp: '5 hours ago',
    status: 'completed' as const,
  },
  {
    id: '3',
    type: 'receive' as const,
    amount: 1000,
    address: '0x9876543210fedcba9876543210fedcba98765432',
    timestamp: '1 day ago',
    status: 'pending' as const,
  },
  {
    id: '4',
    type: 'send' as const,
    amount: 75.50,
    address: '0xfedcba9876543210fedcba9876543210fedcba98',
    timestamp: '2 days ago',
    status: 'completed' as const,
  },
  {
    id: '5',
    type: 'receive' as const,
    amount: 350,
    address: '0x5678901234abcdef5678901234abcdef56789012',
    timestamp: '3 days ago',
    status: 'completed' as const,
  },
];

export default function TransactionListExample() {
  return <TransactionList transactions={mockTransactions} />;
}
