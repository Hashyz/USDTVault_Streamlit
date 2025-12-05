import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Delete, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'setup' | 'verify' | 'update' | 'remove';
  onSuccess?: (verified: boolean) => void;
  title?: string;
  description?: string;
}

export default function PinModal({
  open,
  onClose,
  mode,
  onSuccess,
  title,
  description,
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'pin' | 'confirm' | 'password' | 'oldPin'>('pin');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockoutMessage, setLockoutMessage] = useState('');
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPin('');
      setConfirmPin('');
      setPassword('');
      setOldPin('');
      setError('');
      setStep(mode === 'update' ? 'oldPin' : mode === 'remove' || mode === 'setup' ? 'password' : 'pin');
      setAttemptsRemaining(null);
      setLockoutMessage('');
    }
  }, [open, mode]);

  // Setup PIN mutation
  const setupPinMutation = useMutation({
    mutationFn: async (data: { pin: string; password: string }) =>
      apiRequest('/api/auth/pin/setup', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'PIN Setup Complete',
        description: 'Your PIN has been set up successfully',
      });
      onSuccess?.(true);
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to set up PIN';
      setError(errorMessage);
      
      // If password is invalid, go back to password step
      if (errorMessage.toLowerCase().includes('password')) {
        setStep('password');
        setPassword('');
      }
    },
  });

  // Verify PIN mutation
  const verifyPinMutation = useMutation({
    mutationFn: async (data: { pin: string }) =>
      apiRequest('/api/auth/pin/verify', 'POST', data),
    onSuccess: () => {
      onSuccess?.(true);
      onClose();
    },
    onError: (error: any) => {
      const errorData = error.response?.data || error;
      setError(errorData.message || 'Invalid PIN');
      
      if (errorData.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining);
      }
      
      if (errorData.lockoutUntil) {
        const lockoutTime = new Date(errorData.lockoutUntil);
        const minutes = Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60));
        setLockoutMessage(`Account locked. Try again in ${minutes} minutes.`);
      }
    },
  });

  // Update PIN mutation
  const updatePinMutation = useMutation({
    mutationFn: async (data: { oldPin: string; newPin: string }) =>
      apiRequest('/api/auth/pin/update', 'PUT', data),
    onSuccess: () => {
      toast({
        title: 'PIN Updated',
        description: 'Your PIN has been updated successfully',
      });
      onSuccess?.(true);
      onClose();
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update PIN');
    },
  });

  // Remove PIN mutation
  const removePinMutation = useMutation({
    mutationFn: async (data: { password: string }) =>
      apiRequest('/api/auth/pin/remove', 'DELETE', data),
    onSuccess: () => {
      toast({
        title: 'PIN Removed',
        description: 'Your PIN has been removed successfully',
      });
      onSuccess?.(true);
      onClose();
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to remove PIN');
    },
  });

  const handleNumberClick = useCallback((num: string) => {
    if (lockoutMessage) return;
    
    const currentValue = step === 'confirm' ? confirmPin : step === 'oldPin' ? oldPin : pin;
    if (currentValue.length < 6) {
      if (step === 'confirm') {
        setConfirmPin(prev => prev + num);
      } else if (step === 'oldPin') {
        setOldPin(prev => prev + num);
      } else {
        setPin(prev => prev + num);
      }
      setError('');
    }
  }, [lockoutMessage, step, confirmPin, oldPin, pin]);

  const handleBackspace = useCallback(() => {
    if (lockoutMessage) return;
    
    if (step === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else if (step === 'oldPin') {
      setOldPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
    setError('');
  }, [lockoutMessage, step]);

  const handleClear = useCallback(() => {
    if (lockoutMessage) return;
    
    if (step === 'confirm') {
      setConfirmPin('');
    } else if (step === 'oldPin') {
      setOldPin('');
    } else {
      setPin('');
    }
    setError('');
  }, [lockoutMessage, step]);

  const handleSubmit = useCallback(async () => {
    if (lockoutMessage) return;

    if (mode === 'setup') {
      if (step === 'password') {
        if (!password) {
          setError('Password is required');
          return;
        }
        // Validate password before proceeding to PIN step
        try {
          const response = await apiRequest('/api/auth/validate-password', 'POST', { password });
          if (response.valid) {
            setStep('pin');
            setError('');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Invalid password';
          setError(errorMessage);
          return;
        }
      } else if (step === 'pin') {
        if (pin.length !== 6) {
          setError('PIN must be exactly 6 digits');
          return;
        }
        setStep('confirm');
        setError('');
      } else if (step === 'confirm') {
        if (confirmPin !== pin) {
          setError('PINs do not match');
          return;
        }
        setupPinMutation.mutate({ pin, password });
      }
    } else if (mode === 'verify') {
      if (pin.length !== 6) {
        setError('PIN must be exactly 6 digits');
        return;
      }
      verifyPinMutation.mutate({ pin });
    } else if (mode === 'update') {
      if (step === 'oldPin') {
        if (oldPin.length !== 6) {
          setError('PIN must be exactly 6 digits');
          return;
        }
        setStep('pin');
        setError('');
      } else if (step === 'pin') {
        if (pin.length !== 6) {
          setError('PIN must be exactly 6 digits');
          return;
        }
        setStep('confirm');
        setError('');
      } else if (step === 'confirm') {
        if (confirmPin !== pin) {
          setError('PINs do not match');
          return;
        }
        updatePinMutation.mutate({ oldPin, newPin: pin });
      }
    } else if (mode === 'remove') {
      if (step === 'password') {
        if (!password) {
          setError('Password is required');
          return;
        }
        removePinMutation.mutate({ password });
      }
    }
  }, [lockoutMessage, mode, step, password, pin, confirmPin, oldPin, setupPinMutation, verifyPinMutation, updatePinMutation, removePinMutation]);

  // Handle keyboard input for PIN entry
  useEffect(() => {
    if (!open || step === 'password' || lockoutMessage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle numeric keys (0-9) from both main keyboard and numpad
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberClick(e.key);
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
      // Handle delete/clear
      else if (e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
      // Handle enter for submit when PIN is complete
      else if (e.key === 'Enter') {
        const currentValue = step === 'confirm' ? confirmPin : step === 'oldPin' ? oldPin : pin;
        if (currentValue.length === 6) {
          e.preventDefault();
          handleSubmit();
        }
      }
      // Handle escape to close (only if not loading)
      else if (e.key === 'Escape' && !setupPinMutation.isPending && !verifyPinMutation.isPending && 
               !updatePinMutation.isPending && !removePinMutation.isPending) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, step, lockoutMessage, pin, confirmPin, oldPin, handleNumberClick, handleBackspace, handleClear, handleSubmit, onClose, 
      setupPinMutation.isPending, verifyPinMutation.isPending, updatePinMutation.isPending, removePinMutation.isPending]);

  const getModalTitle = () => {
    if (title) return title;
    
    switch (mode) {
      case 'setup':
        return 'Set Up PIN';
      case 'verify':
        return 'Enter PIN';
      case 'update':
        return 'Update PIN';
      case 'remove':
        return 'Remove PIN';
      default:
        return 'Security PIN';
    }
  };

  const getModalDescription = () => {
    if (description) return description;
    
    if (mode === 'setup') {
      if (step === 'password') return 'Enter your password to set up a PIN';
      if (step === 'pin') return 'Create a 6-digit PIN for additional security';
      if (step === 'confirm') return 'Confirm your 6-digit PIN';
    } else if (mode === 'verify') {
      return 'Enter your 6-digit PIN to continue';
    } else if (mode === 'update') {
      if (step === 'oldPin') return 'Enter your current PIN';
      if (step === 'pin') return 'Enter your new 6-digit PIN';
      if (step === 'confirm') return 'Confirm your new PIN';
    } else if (mode === 'remove') {
      return 'Enter your password to remove PIN protection';
    }
    
    return '';
  };

  const currentPin = step === 'confirm' ? confirmPin : step === 'oldPin' ? oldPin : pin;
  const isLoading = setupPinMutation.isPending || verifyPinMutation.isPending || 
                   updatePinMutation.isPending || removePinMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={() => !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">
                {setupPinMutation.isPending ? 'Setting up PIN...' :
                 verifyPinMutation.isPending ? 'Verifying PIN...' :
                 updatePinMutation.isPending ? 'Updating PIN...' :
                 removePinMutation.isPending ? 'Removing PIN...' :
                 'Processing...'}
              </p>
            </div>
          </div>
        )}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>{getModalDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lockoutMessage && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>{lockoutMessage}</AlertDescription>
            </Alert>
          )}

          {error && !lockoutMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <span className="block mt-1">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {(mode === 'setup' && step === 'password') || (mode === 'remove' && step === 'password') ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>
          ) : (
            <>
              {/* PIN Display */}
              <div className="flex justify-center gap-2">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-12 border-2 rounded-md flex items-center justify-center text-lg font-semibold"
                    style={{
                      borderColor: i < currentPin.length 
                        ? 'hsl(var(--primary))' 
                        : 'hsl(var(--border))',
                      backgroundColor: i < currentPin.length
                        ? 'hsl(var(--primary) / 0.1)'
                        : 'transparent',
                    }}
                    data-testid={`pin-digit-${i}`}
                  >
                    {currentPin[i] ? '•' : ''}
                  </div>
                ))}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    size="lg"
                    onClick={() => handleNumberClick(num.toString())}
                    disabled={isLoading || !!lockoutMessage}
                    className="h-12 text-lg font-semibold"
                    data-testid={`button-num-${num}`}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  disabled={isLoading || !!lockoutMessage}
                  className="h-12"
                  data-testid="button-clear"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumberClick('0')}
                  disabled={isLoading || !!lockoutMessage}
                  className="h-12 text-lg font-semibold"
                  data-testid="button-num-0"
                >
                  0
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleBackspace}
                  disabled={isLoading || !!lockoutMessage}
                  className="h-12"
                  data-testid="button-backspace"
                >
                  <Delete className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !!lockoutMessage || 
                       ((step === 'pin' || step === 'confirm' || step === 'oldPin') && currentPin.length !== 6) ||
                       ((step === 'password') && !password)}
              className="flex-1"
              data-testid="button-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                step === 'confirm' ? 'Confirm' :
                step === 'pin' && mode === 'setup' ? 'Next' :
                step === 'pin' && mode === 'update' ? 'Next' :
                step === 'oldPin' ? 'Next' :
                step === 'password' ? 'Continue' :
                'Submit'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}