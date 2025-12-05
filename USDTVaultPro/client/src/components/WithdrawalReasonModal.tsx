import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle,
  Heart,
  Target,
  TrendingDown,
  Shield,
  CircleDollarSign,
  Sparkles,
  Home,
  RefreshCcw,
  HelpCircle,
  AlertCircle,
  Trophy,
  Zap,
  Bot,
  User,
  MessageCircle,
  Send,
  Loader2,
  RotateCcw,
  Clock,
  ChevronRight,
  Brain,
  CheckCircle2,
  X
} from 'lucide-react';
import { type SavingsGoal } from '@shared/schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { format } from 'date-fns';

interface WithdrawalReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SavingsGoal;
  onContinue: (reason: string, details?: string) => void;
  onCancel: () => void;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
}

interface CounselingResponse {
  message: string;
  suggestedActions?: string[];
  resources?: string[];
  sentiment?: 'supportive' | 'cautious' | 'celebratory' | 'concerned';
  shouldShowWarning?: boolean;
  conversationId?: string;
  isFallback?: boolean;
}

const WITHDRAWAL_REASONS = [
  {
    id: 'emergency',
    label: 'Emergency expense',
    icon: AlertCircle,
    color: 'text-destructive',
    warning: 'Consider if this is truly an emergency. Your future self will thank you for saving.',
    severity: 'medium',
    suggestions: [
      'Can you borrow from a friend or family instead?',
      'Is there a payment plan available?',
      'Can this expense wait a few days?'
    ]
  },
  {
    id: 'achieved',
    label: 'Achieved my goal',
    icon: Trophy,
    color: 'text-success',
    warning: null,
    severity: 'low',
    message: 'Congratulations on reaching your goal! This is what saving is all about.'
  },
  {
    id: 'changed-mind',
    label: 'Changed my mind about saving',
    icon: RefreshCcw,
    color: 'text-muted-foreground',
    warning: 'Remember: savings help build financial security. Every dollar saved is a step toward financial freedom.',
    severity: 'medium',
    suggestions: [
      'Saving habits take time to build',
      'Even small amounts add up over time',
      'Financial security reduces stress'
    ]
  },
  {
    id: 'gambling',
    label: 'Need money for gambling',
    icon: AlertTriangle,
    color: 'text-destructive',
    warning: '⚠️ Gambling can be addictive. Consider keeping your savings locked.',
    severity: 'high',
    suggestions: [
      'Set a strict budget for entertainment',
      'Seek help if gambling feels out of control',
      'Your savings are for your future, not for risking'
    ],
    helplines: [
      'National Problem Gambling Helpline: 1-800-522-4700',
      'Visit www.ncpgambling.org for resources'
    ]
  },
  {
    id: 'investment',
    label: 'Found a better investment opportunity',
    icon: TrendingDown,
    color: 'text-info',
    warning: 'Make sure this opportunity is legitimate and aligns with your risk tolerance.',
    severity: 'medium',
    suggestions: [
      'Have you researched this investment thoroughly?',
      'Is this a guaranteed return or speculative?',
      'Consider keeping some emergency savings'
    ]
  },
  {
    id: 'other',
    label: 'Other reason',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    warning: 'Remember: savings help build financial security.',
    severity: 'low',
    requiresDetails: true
  }
];

const QUICK_REPLIES = {
  initial: [
    "Tell me more about why this is bad",
    "I understand, but I still need it",
    "You're right, I'll keep saving"
  ],
  emergency: [
    "Can I explore payment plans?",
    "What if it's truly urgent?",
    "I'll try to find another way"
  ],
  gambling: [
    "I need help with this",
    "It's just this once",
    "You're right, this is risky"
  ],
  investment: [
    "Tell me about safer options",
    "I've done my research",
    "Maybe I should wait"
  ]
};

export default function WithdrawalReasonModal({
  open,
  onOpenChange,
  goal,
  onContinue,
  onCancel
}: WithdrawalReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReasonDetails, setOtherReasonDetails] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [showCounseling, setShowCounseling] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [conversationStartTime, setConversationStartTime] = useState<Date | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const currentAmount = parseFloat(goal.current || '0');
  const targetAmount = parseFloat(goal.target);
  const progress = (currentAmount / targetAmount) * 100;
  const savingsStreak = parseInt(goal.savingStreak || '0');

  const selectedReasonData = WITHDRAWAL_REASONS.find(r => r.id === selectedReason);

  // Smooth scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, isTyping]);

  // Fetch withdrawal history
  const { data: withdrawalHistory } = useQuery({
    queryKey: ['/api/withdrawal-history'],
    enabled: showCounseling
  });

  // AI Counseling mutation
  const counselingMutation = useMutation({
    mutationFn: async (data: {
      reason: string;
      goalDetails: any;
      conversationHistory?: ConversationMessage[];
      conversationId?: string | null;
    }) => {
      setIsTyping(true);
      return apiRequest('/api/ai/withdrawal-counseling', 'POST', data);
    },
    onSuccess: (response: CounselingResponse) => {
      setIsTyping(false);
      
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }
      
      // Determine quick replies based on context
      let replies = QUICK_REPLIES.initial;
      if (selectedReason === 'emergency') {
        replies = QUICK_REPLIES.emergency;
      } else if (selectedReason === 'gambling') {
        replies = QUICK_REPLIES.gambling;
      } else if (selectedReason === 'investment') {
        replies = QUICK_REPLIES.investment;
      }
      
      // Add AI response to conversation with quick replies
      const aiMessage: ConversationMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        quickReplies: messageCount === 0 ? replies : []
      };
      setConversation(prev => [...prev, aiMessage]);
      setQuickReplies(aiMessage.quickReplies || []);

      if (response.isFallback) {
        toast({
          title: 'Using offline guidance',
          description: 'AI counselor is temporarily unavailable, showing curated advice.',
          variant: 'default'
        });
      }
    },
    onError: () => {
      setIsTyping(false);
      toast({
        title: 'Connection error',
        description: 'Unable to connect to counseling service. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Update conversation outcome mutation
  const outcomeMutation = useMutation({
    mutationFn: async (outcome: 'withdrew' | 'kept') => {
      if (!conversationId) return;
      
      // Track time spent in counseling
      const timeSpent = conversationStartTime 
        ? Math.floor((new Date().getTime() - conversationStartTime.getTime()) / 1000)
        : 0;
        
      return apiRequest('/api/ai/conversation-outcome', 'POST', {
        conversationId,
        outcome,
        timeSpent,
        messageCount
      });
    }
  });

  const handleReasonSelect = (value: string) => {
    setSelectedReason(value);
    const reason = WITHDRAWAL_REASONS.find(r => r.id === value);
    if (reason && reason.severity === 'high') {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  const handleProceedToWithdraw = () => {
    if (!selectedReason) return;
    
    // Show AI counseling interface
    setShowCounseling(true);
    setConversationStartTime(new Date());
    
    // Get initial AI counseling response
    const goalDetails = {
      id: goal.id,
      title: goal.title,
      current: goal.current,
      target: goal.target,
      progress: progress,
      deadline: goal.deadline,
      savingStreak: goal.savingStreak
    };

    counselingMutation.mutate({
      reason: selectedReason,
      goalDetails,
      conversationHistory: [],
      conversationId: null
    });
  };

  const handleSendMessage = (message?: string) => {
    const msgToSend = message || userMessage;
    if (!msgToSend.trim() || messageCount >= 3) return;

    // Add user message to conversation
    const newMessage: ConversationMessage = {
      role: 'user',
      content: msgToSend,
      timestamp: new Date()
    };
    setConversation(prev => [...prev, newMessage]);
    setUserMessage('');
    setQuickReplies([]);
    setMessageCount(prev => prev + 1);

    // Send to AI counseling
    const goalDetails = {
      id: goal.id,
      title: goal.title,
      current: goal.current,
      target: goal.target,
      progress: progress,
      deadline: goal.deadline,
      savingStreak: goal.savingStreak
    };

    counselingMutation.mutate({
      reason: selectedReason,
      goalDetails,
      conversationHistory: [...conversation, newMessage],
      conversationId
    });
  };

  const handleQuickReply = (reply: string) => {
    handleSendMessage(reply);
  };

  const handleResetConversation = () => {
    setConversation([]);
    setMessageCount(0);
    setQuickReplies([]);
    setConversationStartTime(new Date());
    
    // Restart the conversation
    handleProceedToWithdraw();
  };

  const handleContinueAnyway = async () => {
    // Record the outcome
    await outcomeMutation.mutateAsync('withdrew');
    
    const details = selectedReason === 'other' ? otherReasonDetails : undefined;
    onContinue(selectedReason, details);
    resetModal();
  };

  const handleKeepSaving = async () => {
    // Record the outcome
    if (conversationId) {
      await outcomeMutation.mutateAsync('kept');
    }
    
    // Show confetti effect
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
    
    // Show positive reinforcement
    toast({
      title: '🏆 Amazing Decision!',
      description: 'You\'ve made the smart choice! Your discipline today builds wealth tomorrow. Keep crushing those savings goals!',
      variant: 'default'
    });
    
    // Add achievement badge animation
    setTimeout(() => {
      toast({
        title: '✨ Achievement Unlocked!',
        description: 'Willpower Warrior - Resisted a withdrawal temptation',
        variant: 'default'
      });
    }, 2000);
    
    onCancel();
    resetModal();
    onOpenChange(false);
  };

  const resetModal = () => {
    setSelectedReason('');
    setOtherReasonDetails('');
    setShowWarning(false);
    setShowCounseling(false);
    setConversation([]);
    setConversationId(null);
    setUserMessage('');
    setMessageCount(0);
    setIsTyping(false);
    setShowConfetti(false);
    setConversationStartTime(null);
    setQuickReplies([]);
  };

  const canContinue = selectedReason && (
    selectedReason !== 'other' || otherReasonDetails.trim().length > 0
  );

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      resetModal();
    }
  }, [open]);

  return (
    <>
      {/* Confetti Effect */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}
      
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          resetModal();
        }
        onOpenChange(newOpen);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="modal-withdrawal-reason">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {showCounseling ? (
                  <>
                    <Bot className="w-5 h-5 text-primary" />
                    AI Financial Counselor
                  </>
                ) : (
                  <>
                    <CircleDollarSign className="w-5 h-5 text-primary" />
                    Why do you want to withdraw from your savings?
                  </>
                )}
              </span>
              {showCounseling && conversation.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetConversation}
                  className="h-8 w-8"
                  data-testid="button-reset-conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {showCounseling 
                ? 'Let\'s talk about your decision. I\'m here to help you think through this.'
                : 'Help us understand your needs better. This information helps you track your financial patterns.'
              }
            </DialogDescription>
          </DialogHeader>

          {!showCounseling ? (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Goal Progress Summary */}
                <Card className="bg-background-secondary/50 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        {goal.title}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {progress.toFixed(0)}% Complete
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={progress} className="h-2" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-mono font-semibold">${currentAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-mono font-semibold">${targetAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Streak</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-primary" />
                          {savingsStreak} days
                        </p>
                      </div>
                    </div>

                    {progress > 75 && (
                      <Alert className="border-success/20 bg-success/5">
                        <Trophy className="w-4 h-4 text-success" />
                        <AlertDescription className="text-success">
                          You're {progress.toFixed(0)}% there! So close to your goal!
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Reason Selection */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Select your reason:</Label>
                  <RadioGroup value={selectedReason} onValueChange={handleReasonSelect}>
                    <div className="space-y-3">
                      {WITHDRAWAL_REASONS.map((reason) => (
                        <div key={reason.id} className="flex items-start space-x-3">
                          <RadioGroupItem 
                            value={reason.id} 
                            id={reason.id}
                            data-testid={`radio-reason-${reason.id}`}
                          />
                          <Label 
                            htmlFor={reason.id} 
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <reason.icon className={`w-4 h-4 ${reason.color}`} />
                            <span>{reason.label}</span>
                            {reason.severity === 'high' && (
                              <Badge variant="destructive" className="ml-auto">
                                High Risk
                              </Badge>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  {/* Other Reason Details */}
                  {selectedReason === 'other' && (
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="other-details">Please specify your reason:</Label>
                      <Textarea
                        id="other-details"
                        value={otherReasonDetails}
                        onChange={(e) => setOtherReasonDetails(e.target.value)}
                        placeholder="Tell us more about why you need to withdraw..."
                        className="min-h-[80px]"
                        data-testid="textarea-other-reason"
                      />
                    </div>
                  )}
                </div>

                {/* Warning Messages */}
                {selectedReasonData && selectedReasonData.warning && (
                  <Alert className={`border-${selectedReasonData.severity === 'high' ? 'destructive' : 'warning'}/20 bg-${selectedReasonData.severity === 'high' ? 'destructive' : 'warning'}/5`}>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="space-y-2">
                      <p className="font-medium">{selectedReasonData.warning}</p>
                      
                      {selectedReasonData.suggestions && (
                        <ul className="mt-2 space-y-1">
                          {selectedReasonData.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-sm flex items-start gap-2">
                              <span className="text-muted-foreground mt-0.5">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {selectedReasonData.helplines && (
                        <div className="mt-3 pt-3 border-t border-destructive/20">
                          <p className="text-sm font-medium mb-1">Need help?</p>
                          {selectedReasonData.helplines.map((helpline, index) => (
                            <p key={index} className="text-sm text-muted-foreground">
                              {helpline}
                            </p>
                          ))}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Positive Message for Goal Achievement */}
                {selectedReason === 'achieved' && (
                  <Alert className="border-success/20 bg-success/5">
                    <Sparkles className="w-4 h-4 text-success" />
                    <AlertDescription>
                      <p className="font-medium text-success">
                        Congratulations! You've successfully saved ${currentAmount.toFixed(2)}!
                      </p>
                      <p className="text-sm mt-1">
                        This withdrawal is a celebration of your financial discipline. Well done!
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>
          ) : (
            /* AI Counseling Conversation UI */
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {/* Goal context reminder */}
                  <Card className="bg-background-secondary/30 border-muted">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Withdrawing from:</span>
                        <span className="font-medium">{goal.title}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-mono font-semibold text-primary">
                          ${currentAmount.toFixed(2)}
                        </span>
                      </div>
                      {conversationStartTime && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="w-3 h-3" />
                          <span>Session started {format(conversationStartTime, 'h:mm a')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Conversation messages */}
                  <AnimatePresence>
                    {conversation.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10">
                              <Bot className="w-4 h-4 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className="flex flex-col gap-1 max-w-[80%]">
                          <Card className={`${
                            msg.role === 'user' 
                              ? 'bg-primary/5 border-primary/20' 
                              : 'bg-background-secondary/50 border-muted'
                          }`}>
                            <CardContent className="p-3">
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </CardContent>
                          </Card>
                          <span className="text-xs text-muted-foreground px-1">
                            {format(msg.timestamp, 'h:mm a')}
                          </span>
                        </div>
                        
                        {msg.role === 'user' && (
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="bg-muted">
                              <User className="w-4 h-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex gap-3 justify-start"
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="w-4 h-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <Card className="bg-background-secondary/50 border-muted">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <motion.div
                                className="w-2 h-2 rounded-full bg-primary/50"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full bg-primary/50"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full bg-primary/50"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground ml-1">
                              AI is thinking...
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Quick reply buttons */}
                  {quickReplies.length > 0 && !isTyping && messageCount < 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap gap-2 mt-2"
                    >
                      {quickReplies.map((reply, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickReply(reply)}
                          className="text-xs"
                          data-testid={`button-quick-reply-${index}`}
                        >
                          <ChevronRight className="w-3 h-3 mr-1" />
                          {reply}
                        </Button>
                      ))}
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message input - show only if under 3 messages */}
              {messageCount < 3 && conversation.length > 0 && !isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t p-4 bg-background"
                >
                  <div className="flex gap-2">
                    <Textarea
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your response..."
                      className="min-h-[60px] resize-none"
                      disabled={isTyping}
                      data-testid="input-counseling-message"
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!userMessage.trim() || isTyping}
                      size="icon"
                      className="flex-shrink-0"
                      data-testid="button-send-message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {3 - messageCount} response{3 - messageCount !== 1 ? 's' : ''} remaining
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t flex-shrink-0">
            {!showCounseling ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetModal();
                    onOpenChange(false);
                  }}
                  data-testid="button-cancel-withdrawal"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={handleKeepSaving}
                    data-testid="button-keep-saving"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Keep Saving
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleProceedToWithdraw}
                    disabled={!canContinue}
                    data-testid="button-proceed-withdrawal"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Proceed to Withdraw
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  onClick={handleKeepSaving}
                  className="flex-1"
                  data-testid="button-convinced-keep-saving"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  You're Right, I'll Keep Saving
                </Button>
                <Button
                  variant="outline"
                  onClick={handleContinueAnyway}
                  disabled={messageCount === 0}
                  data-testid="button-continue-anyway"
                >
                  I Still Need to Withdraw
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}