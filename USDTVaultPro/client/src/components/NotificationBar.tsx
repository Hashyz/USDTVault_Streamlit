import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X,
  Bell,
  Target,
  TrendingUp,
  Award,
  Calendar,
  DollarSign,
  Zap,
  Info,
  ChevronRight,
  Sparkles,
  Trophy,
  Clock
} from 'lucide-react';
import { differenceInDays, addDays, format } from 'date-fns';
import type { SavingsGoal, Transaction } from '@shared/schema';

// Motivational quotes for behavioral nudges
const MOTIVATIONAL_QUOTES = [
  "Every dollar saved is a step towards financial freedom.",
  "Small savings today, big rewards tomorrow.",
  "Your future self will thank you for saving today.",
  "Compound interest is the eighth wonder of the world.",
  "A penny saved is a penny earned.",
  "Save money and money will save you.",
  "Financial peace isn't buying everything you want, it's living on less than you make.",
  "Don't save what's left after spending; spend what's left after saving.",
  "The habit of saving is itself an education.",
  "Wealth consists not in having great possessions, but in having few wants."
];

interface NotificationData {
  id: string;
  type: 'reminder' | 'milestone' | 'streak' | 'progress' | 'nudge' | 'deadline' | 'forecast';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  priority: number; // Lower number = higher priority
  color: 'default' | 'success' | 'warning' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function NotificationBar() {
  const { user } = useAuth();
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);
  
  // Fetch user data
  const { data: goals = [] } = useQuery<SavingsGoal[]>({
    queryKey: ['/api/savings-goals'],
  });
  
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ['/api/wallet'],
  });
  
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('dismissedNotifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only keep dismissals from the last 24 hours
      const recent = parsed.filter((item: { id: string; time: string }) => {
        const dismissTime = new Date(item.time);
        return differenceInDays(new Date(), dismissTime) < 1;
      });
      setDismissedNotifications(new Set(recent.map((item: { id: string }) => item.id)));
    }
  }, []);

  // Calculate all possible notifications based on current data
  const notifications = useMemo(() => {
    const notifs: NotificationData[] = [];
    const now = new Date();
    const balance = parseFloat(walletData?.balance || user?.balance || '0');
    
    // 1. Goal Reminder Notifications
    if (goals.length > 0) {
      // Daily reminder
      notifs.push({
        id: 'daily-reminder',
        type: 'reminder',
        icon: Bell,
        title: 'Daily Check-in',
        description: `Don't forget to check your savings progress! You have ${goals.length} active goal${goals.length > 1 ? 's' : ''}.`,
        priority: 50,
        color: 'info'
      });
      
      // Goal deadline approaching
      goals.forEach((goal) => {
        const daysLeft = differenceInDays(new Date(goal.deadline), now);
        const progress = (parseFloat(goal.current || '0') / parseFloat(goal.target)) * 100;
        
        if (daysLeft <= 7 && daysLeft > 0 && progress < 100) {
          notifs.push({
            id: `deadline-${goal.id}`,
            type: 'deadline',
            icon: Clock,
            title: 'Goal Deadline Approaching!',
            description: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left to reach your "${goal.title}" goal. ${progress.toFixed(0)}% complete.`,
            priority: 10,
            color: 'warning'
          });
        }
        
        // Auto-save reminder
        if (goal.autoSaveEnabled && goal.nextAutoSave) {
          const daysToAutoSave = differenceInDays(new Date(goal.nextAutoSave), now);
          if (daysToAutoSave === 1) {
            notifs.push({
              id: `auto-save-${goal.id}`,
              type: 'reminder',
              icon: Calendar,
              title: 'Auto-save Tomorrow',
              description: `Your next auto-save of $${goal.autoSaveAmount} for "${goal.title}" is scheduled for tomorrow.`,
              priority: 20,
              color: 'info'
            });
          }
        }
        
        // Milestone celebration
        const milestones = [25, 50, 75, 100];
        milestones.forEach((milestone) => {
          if (progress >= milestone && progress < milestone + 5) {
            notifs.push({
              id: `milestone-${goal.id}-${milestone}`,
              type: 'milestone',
              icon: Trophy,
              title: `${milestone}% Milestone Reached!`,
              description: `Congratulations! You've saved $${parseFloat(goal.current || '0').toFixed(2)} towards "${goal.title}".`,
              priority: 5,
              color: 'success'
            });
          }
        });
      });
    }
    
    // 2. Streak Notifications
    const streaks = goals.map(g => parseInt(g.savingStreak || '0')).filter(s => s > 0);
    const maxStreak = Math.max(...streaks, 0);
    
    if (maxStreak > 0) {
      // Daily streak reminder
      notifs.push({
        id: 'streak-daily',
        type: 'streak',
        icon: Zap,
        title: `${maxStreak}-Day Streak!`,
        description: `Keep your ${maxStreak}-day saving streak going! Consistency is key to reaching your goals.`,
        priority: 30,
        color: 'success'
      });
      
      // Streak milestones
      const streakMilestones = [7, 30, 100];
      streakMilestones.forEach((milestone) => {
        if (maxStreak === milestone) {
          notifs.push({
            id: `streak-milestone-${milestone}`,
            type: 'milestone',
            icon: Award,
            title: `Amazing! ${milestone}-Day Saving Streak!`,
            description: `You've maintained a ${milestone}-day saving streak. That's dedication!`,
            priority: 1,
            color: 'success'
          });
        }
      });
      
      // Streak at risk (if last withdrawal was recent)
      const lastWithdrawal = goals.find(g => g.lastWithdrawal);
      if (lastWithdrawal && lastWithdrawal.lastWithdrawal) {
        const daysSinceWithdrawal = differenceInDays(now, new Date(lastWithdrawal.lastWithdrawal));
        if (daysSinceWithdrawal <= 3) {
          notifs.push({
            id: 'streak-risk',
            type: 'streak',
            icon: Info,
            title: 'Keep Your Streak Going!',
            description: `Your last withdrawal was ${daysSinceWithdrawal} day${daysSinceWithdrawal > 1 ? 's' : ''} ago. Stay strong and keep saving!`,
            priority: 25,
            color: 'warning'
          });
        }
      }
    }
    
    // 3. Smart Progress Updates
    if (goals.length > 0) {
      const totalSaved = goals.reduce((sum, g) => sum + parseFloat(g.current || '0'), 0);
      const totalTarget = goals.reduce((sum, g) => sum + parseFloat(g.target), 0);
      const overallProgress = (totalSaved / totalTarget) * 100;
      
      // Weekly summary (show on Mondays)
      if (now.getDay() === 1) {
        // Calculate weekly savings from recent transactions
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weeklyTransactions = transactions.filter(t => new Date(t.createdAt) >= weekAgo);
        const weeklySavings = weeklyTransactions
          .filter(t => t.type === 'receive')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        if (weeklySavings > 0) {
          notifs.push({
            id: 'weekly-summary',
            type: 'progress',
            icon: BarChart3,
            title: 'Weekly Summary',
            description: `This week you saved $${weeklySavings.toFixed(2)} and got ${(overallProgress - (overallProgress - 5)).toFixed(1)}% closer to your goals!`,
            priority: 40,
            color: 'info'
          });
        }
      }
      
      // Goal completion forecast
      const activeGoals = goals.filter(g => parseFloat(g.current || '0') < parseFloat(g.target));
      if (activeGoals.length > 0) {
        const nearestGoal = activeGoals.sort((a, b) => {
          const progressA = parseFloat(a.current || '0') / parseFloat(a.target);
          const progressB = parseFloat(b.current || '0') / parseFloat(b.target);
          return progressB - progressA;
        })[0];
        
        const remaining = parseFloat(nearestGoal.target) - parseFloat(nearestGoal.current || '0');
        const avgMonthlySaving = totalSaved / 3; // Assume 3 months average
        if (avgMonthlySaving > 0) {
          const monthsToGoal = remaining / avgMonthlySaving;
          const completionDate = addDays(now, monthsToGoal * 30);
          
          notifs.push({
            id: `forecast-${nearestGoal.id}`,
            type: 'forecast',
            icon: TrendingUp,
            title: 'Goal Forecast',
            description: `At this rate, you'll reach "${nearestGoal.title}" by ${format(completionDate, 'MMM d, yyyy')}.`,
            priority: 45,
            color: 'info'
          });
        }
      }
      
      // Savings rate insight
      if (balance > 0) {
        const savingsRate = (totalSaved / (balance + totalSaved)) * 100;
        notifs.push({
          id: 'savings-rate',
          type: 'progress',
          icon: DollarSign,
          title: 'Savings Rate',
          description: `You're saving ${savingsRate.toFixed(1)}% of your portfolio value. Great job building your savings!`,
          priority: 60,
          color: 'info'
        });
      }
    }
    
    // 4. Behavioral Nudges
    // Balance increase nudge
    const recentTransaction = transactions[0];
    if (recentTransaction && recentTransaction.type === 'receive') {
      const amount = parseFloat(recentTransaction.amount);
      if (amount > 0) {
        notifs.push({
          id: `balance-increase-${recentTransaction.id}`,
          type: 'nudge',
          icon: TrendingUp,
          title: 'Portfolio Growth!',
          description: `Great job! Your portfolio grew by $${amount.toFixed(2)} today.`,
          priority: 35,
          color: 'success'
        });
      }
    }
    
    // Approaching goal nudge
    goals.forEach((goal) => {
      const remaining = parseFloat(goal.target) - parseFloat(goal.current || '0');
      const progress = (parseFloat(goal.current || '0') / parseFloat(goal.target)) * 100;
      
      if (progress >= 80 && progress < 100 && remaining < 500) {
        notifs.push({
          id: `approaching-${goal.id}`,
          type: 'nudge',
          icon: Target,
          title: 'Almost There!',
          description: `Only $${remaining.toFixed(2)} away from reaching "${goal.title}"! You're so close!`,
          priority: 15,
          color: 'success'
        });
      }
    });
    
    // Random motivational quote (always available)
    const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    notifs.push({
      id: `motivation-${now.getDate()}`,
      type: 'nudge',
      icon: Sparkles,
      title: 'Daily Motivation',
      description: randomQuote,
      priority: 100,
      color: 'default'
    });
    
    return notifs.sort((a, b) => a.priority - b.priority);
  }, [goals, walletData, user, transactions]);

  // Filter out dismissed notifications and get the current one to show
  const activeNotifications = useMemo(() => {
    return notifications.filter(n => !dismissedNotifications.has(n.id));
  }, [notifications, dismissedNotifications]);

  // Rotate through notifications every 10 seconds
  useEffect(() => {
    if (activeNotifications.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentNotificationIndex((prev) => 
        (prev + 1) % activeNotifications.length
      );
    }, 10000); // Rotate every 10 seconds
    
    return () => clearInterval(interval);
  }, [activeNotifications]);

  // Handle dismissing a notification
  const dismissNotification = (id: string) => {
    const newDismissed = new Set(dismissedNotifications);
    newDismissed.add(id);
    setDismissedNotifications(newDismissed);
    
    // Save to localStorage
    const dismissalData = Array.from(newDismissed).map(notifId => ({
      id: notifId,
      time: new Date().toISOString()
    }));
    localStorage.setItem('dismissedNotifications', JSON.stringify(dismissalData));
    
    // Move to next notification
    if (activeNotifications.length > 1) {
      setCurrentNotificationIndex((prev) => 
        prev >= activeNotifications.length - 1 ? 0 : prev
      );
    }
  };

  if (activeNotifications.length === 0) {
    return null;
  }

  const currentNotification = activeNotifications[currentNotificationIndex];
  if (!currentNotification) return null;

  const Icon = currentNotification.icon;
  
  const colorClasses = {
    default: 'bg-background-secondary border-border text-foreground',
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    info: 'bg-info/10 border-info/30 text-info'
  };

  return (
    <div 
      className="mb-4 animate-in slide-in-from-top duration-500"
      data-testid="notification-bar"
    >
      <Alert className={`${colorClasses[currentNotification.color]} relative pr-12`}>
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm" data-testid="notification-title">
                {currentNotification.title}
              </p>
              {activeNotifications.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  {currentNotificationIndex + 1} of {activeNotifications.length}
                </Badge>
              )}
            </div>
            <AlertDescription className="text-xs leading-relaxed" data-testid="notification-description">
              {currentNotification.description}
            </AlertDescription>
            {currentNotification.action && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs mt-2"
                onClick={currentNotification.action.onClick}
              >
                {currentNotification.action.label}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-7 w-7 hover:bg-background/50"
            onClick={() => dismissNotification(currentNotification.id)}
            data-testid="button-dismiss-notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}