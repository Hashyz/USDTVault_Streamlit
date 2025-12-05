import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle,
  TrendingDown,
  Calendar,
  Target,
  Heart,
  Zap,
  Shield,
  Award,
  DollarSign,
  Clock,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { type SavingsGoal } from '@shared/schema';

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SavingsGoal;
  onConfirmWithdrawal: (amount: number, useCoolingPeriod: boolean) => void;
  userBalance: number;
}

const REFLECTION_QUESTIONS = [
  {
    question: "Is this withdrawal really necessary?",
    description: "Take a moment to reflect on whether this is a genuine need or a momentary want.",
    icon: Heart,
    color: "text-primary",
    suggestions: [
      "Can you wait a week to see if you still need it?",
      "Is there an alternative solution that doesn't require withdrawing?",
      "Would future you thank present you for waiting?"
    ]
  },
  {
    question: "What problem are you trying to solve?",
    description: "Understanding the real issue can help find better solutions.",
    icon: Target,
    color: "text-info",
    suggestions: [
      "Write down the specific problem you're facing",
      "Consider if there are other resources you can use",
      "Think about the long-term impact of this decision"
    ]
  },
  {
    question: "Remember your commitment",
    description: "You made a promise to yourself. Breaking it affects more than just money.",
    icon: Shield,
    color: "text-success",
    message: "No impulse spending! You're stronger than temporary desires."
  },
  {
    question: "Your savings streak is at risk",
    description: "You've built momentum. Don't let it go to waste.",
    icon: Zap,
    color: "text-primary",
    dynamic: true
  },
  {
    question: "Impact on your goal",
    description: "This withdrawal will delay your dreams.",
    icon: TrendingDown,
    color: "text-destructive",
    showImpact: true
  }
];

export default function WithdrawalModal({ 
  open, 
  onOpenChange, 
  goal, 
  onConfirmWithdrawal,
  userBalance 
}: WithdrawalModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [useCoolingPeriod, setUseCoolingPeriod] = useState(false);
  const [hasReadAllSteps, setHasReadAllSteps] = useState(false);

  const savingsStreak = parseInt(goal.savingStreak || '0');
  const currentAmount = parseFloat(goal.current || '0');
  const targetAmount = parseFloat(goal.target);
  const daysUntilDeadline = differenceInDays(new Date(goal.deadline), new Date());
  
  const withdrawAmount = parseFloat(withdrawalAmount || '0');
  const maxWithdraw = Math.min(currentAmount, userBalance);

  // Calculate impact
  const impactData = useMemo(() => {
    if (!withdrawAmount) return null;
    
    const remainingAfterWithdraw = currentAmount - withdrawAmount;
    const progressBefore = (currentAmount / targetAmount) * 100;
    const progressAfter = (remainingAfterWithdraw / targetAmount) * 100;
    const dailyRequired = (targetAmount - currentAmount) / Math.max(1, daysUntilDeadline);
    const newDailyRequired = (targetAmount - remainingAfterWithdraw) / Math.max(1, daysUntilDeadline);
    const delayDays = Math.ceil((withdrawAmount / dailyRequired));
    
    // Future value calculation (assuming 10% annual growth if not withdrawn)
    const annualGrowthRate = 0.10;
    const futureValue = currentAmount * Math.pow(1 + annualGrowthRate, 1);
    const futureValueAfterWithdraw = remainingAfterWithdraw * Math.pow(1 + annualGrowthRate, 1);
    const lostGrowth = futureValue - futureValueAfterWithdraw;
    
    return {
      progressBefore,
      progressAfter,
      delayDays,
      dailyRequired,
      newDailyRequired,
      futureValue,
      lostGrowth,
      streakLoss: savingsStreak
    };
  }, [withdrawAmount, currentAmount, targetAmount, daysUntilDeadline, savingsStreak]);

  const handleNext = () => {
    if (currentStep < REFLECTION_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setHasReadAllSteps(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = () => {
    if (withdrawAmount > 0) {
      onConfirmWithdrawal(withdrawAmount, useCoolingPeriod);
      resetModal();
    }
  };

  const resetModal = () => {
    setCurrentStep(0);
    setWithdrawalAmount('');
    setUseCoolingPeriod(false);
    setHasReadAllSteps(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const currentQuestion = REFLECTION_QUESTIONS[currentStep];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-withdrawal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Withdrawal Reflection Process
          </DialogTitle>
          <DialogDescription>
            Please think carefully before withdrawing from your savings goal
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {currentStep + 1} of {REFLECTION_QUESTIONS.length}</span>
            <span>{Math.round(((currentStep + 1) / REFLECTION_QUESTIONS.length) * 100)}% Complete</span>
          </div>
          <Progress value={((currentStep + 1) / REFLECTION_QUESTIONS.length) * 100} className="h-2" />
        </div>

        {/* Withdrawal Amount Input (shown on first step) */}
        {currentStep === 0 && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                How much do you want to withdraw?
              </label>
              <div className="flex items-center gap-2 mt-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  max={maxWithdraw}
                  min={0}
                  step="0.01"
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter amount"
                  data-testid="input-withdrawal-amount"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWithdrawalAmount(maxWithdraw.toString())}
                  data-testid="button-withdraw-max"
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available: ${currentAmount.toFixed(2)} | Goal: ${targetAmount.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Reflection Question */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <currentQuestion.icon className={`w-6 h-6 ${currentQuestion.color}`} />
              {currentQuestion.question}
            </CardTitle>
            <CardDescription className="text-foreground/80 mt-2">
              {currentQuestion.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dynamic content based on step */}
            {currentQuestion.dynamic && savingsStreak > 0 && (
              <Alert className="border-primary/20 bg-primary/5">
                <Award className="w-4 h-4 text-primary" />
                <AlertDescription>
                  <span className="font-semibold">You've saved for {savingsStreak} days straight!</span>
                  <br />
                  Are you sure you want to break your streak and start over from Day 0?
                </AlertDescription>
              </Alert>
            )}

            {currentQuestion.showImpact && impactData && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Progress Impact</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{impactData.progressBefore.toFixed(1)}%</Badge>
                      <ChevronRight className="w-4 h-4 text-destructive" />
                      <Badge variant="destructive">{impactData.progressAfter.toFixed(1)}%</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Goal Delay</p>
                    <Badge variant="destructive" className="font-mono">
                      +{impactData.delayDays} days
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Lost Future Value (1 year)</p>
                    <Badge variant="destructive" className="font-mono">
                      -${impactData.lostGrowth.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Streak Reset</p>
                    <Badge variant="destructive">
                      Lose {impactData.streakLoss} days
                    </Badge>
                  </div>
                </div>
                
                <Alert className="border-info/20 bg-info/5">
                  <Info className="w-4 h-4 text-info" />
                  <AlertDescription>
                    <strong>Alternative:</strong> If you don't withdraw, you'll have{' '}
                    <span className="font-mono font-semibold text-success">
                      ${impactData.futureValue.toFixed(2)}
                    </span>{' '}
                    in 1 year (with 10% growth)
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {currentQuestion.suggestions && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Consider these alternatives:</p>
                <ul className="space-y-1">
                  {currentQuestion.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentQuestion.message && (
              <Alert className="border-success/20 bg-success/5">
                <Shield className="w-4 h-4 text-success" />
                <AlertDescription className="text-success font-medium">
                  {currentQuestion.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Cooling Period Option (shown on last step) */}
        {hasReadAllSteps && (
          <div className="space-y-4 mt-4">
            <Alert className="border-info/20 bg-info/5">
              <Clock className="w-4 h-4 text-info" />
              <AlertDescription>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cooling-period"
                    checked={useCoolingPeriod}
                    onCheckedChange={(checked) => setUseCoolingPeriod(checked as boolean)}
                    data-testid="checkbox-cooling-period"
                  />
                  <label
                    htmlFor="cooling-period"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    I want to think about this for 24 hours
                    <span className="block text-xs text-muted-foreground mt-1">
                      Enabling this will lock the withdrawal for 24 hours, giving you time to reconsider
                    </span>
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <div>
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel-withdrawal"
            >
              Cancel Withdrawal
            </Button>
            {!hasReadAllSteps ? (
              <Button
                onClick={handleNext}
                disabled={currentStep === 0 && !withdrawAmount}
                data-testid="button-next"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!withdrawAmount}
                data-testid="button-confirm-withdrawal"
              >
                {useCoolingPeriod ? 'Schedule Withdrawal (24h)' : 'Confirm Withdrawal'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}