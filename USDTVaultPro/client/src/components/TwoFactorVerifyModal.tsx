import { useState, useEffect, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Smartphone,
  Key,
  AlertCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TwoFactorVerifyModalProps {
  open: boolean;
  onClose: () => void;
  tempToken?: string;
  onSuccess?: (token: string, user: any) => void;
  mode?: 'login' | 'verify';
}

export default function TwoFactorVerifyModal({
  open,
  onClose,
  tempToken,
  onSuccess,
  mode = 'login',
}: TwoFactorVerifyModalProps) {
  const [activeTab, setActiveTab] = useState('totp');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setTotpCode('');
      setBackupCode('');
      setError('');
      setActiveTab('totp');
      // Focus input after a short delay
      setTimeout(() => {
        totpInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Login verification mutation
  const verifyLoginMutation = useMutation({
    mutationFn: async (data: { tempToken: string; code: string }) =>
      apiRequest('/api/auth/2fa/login-verify', 'POST', data),
    onSuccess: (data) => {
      toast({
        title: 'Login Successful',
        description: 'Two-factor authentication verified',
      });
      
      // Store token and user data
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.user.id);
      }
      
      onSuccess?.(data.token, data.user);
      onClose();
    },
    onError: (error: any) => {
      const message = error.message || 'Invalid verification code';
      setError(message);
      
      if (message.includes('expired')) {
        toast({
          title: 'Session Expired',
          description: 'Please login again',
          variant: 'destructive',
        });
        onClose();
      }
    },
  });

  // Standard verification mutation (for other 2FA operations)
  const verifyMutation = useMutation({
    mutationFn: async (data: { code: string }) =>
      apiRequest('/api/auth/2fa/verify-action', 'POST', data),
    onSuccess: (data) => {
      toast({
        title: 'Verified',
        description: 'Action authorized successfully',
      });
      onSuccess?.('', data);
      onClose();
    },
    onError: (error: any) => {
      setError(error.message || 'Invalid verification code');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const code = activeTab === 'totp' ? totpCode : backupCode;
    
    if (!code) {
      setError('Please enter a verification code');
      return;
    }

    if (activeTab === 'totp' && code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    if (activeTab === 'backup' && code.length < 8) {
      setError('Please enter a valid backup code');
      return;
    }

    setError('');

    if (mode === 'login' && tempToken) {
      verifyLoginMutation.mutate({ tempToken, code });
    } else {
      verifyMutation.mutate({ code });
    }
  };

  const handleCodeChange = (value: string, type: 'totp' | 'backup') => {
    if (type === 'totp') {
      // Only allow digits and limit to 6 characters
      const cleaned = value.replace(/\D/g, '').slice(0, 6);
      setTotpCode(cleaned);
    } else {
      // Allow alphanumeric for backup codes, convert to uppercase
      const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
      setBackupCode(cleaned);
    }
    setError(''); // Clear error when user types
  };

  const isPending = verifyLoginMutation.isPending || verifyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-2fa-verify">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>Two-Factor Authentication</DialogTitle>
          </div>
          <DialogDescription>
            {mode === 'login'
              ? 'Enter your verification code to complete login'
              : 'Enter your verification code to authorize this action'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp" data-testid="tab-totp">
              <Smartphone className="mr-2 h-4 w-4" />
              Authenticator App
            </TabsTrigger>
            <TabsTrigger value="backup" data-testid="tab-backup">
              <Key className="mr-2 h-4 w-4" />
              Backup Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totp" className="space-y-4">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp-code">6-Digit Code</Label>
                  <Input
                    ref={totpInputRef}
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={totpCode}
                    onChange={(e) => handleCodeChange(e.target.value, 'totp')}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl font-mono tracking-widest"
                    autoComplete="one-time-code"
                    data-testid="input-totp-code"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the code from your authenticator app
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={isPending}
                    data-testid="button-cancel-totp"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isPending || totpCode.length !== 6}
                    data-testid="button-verify-totp"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify
                        <CheckCircle className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Each backup code can only be used once. After using a backup code,
                    you should generate new ones from your settings.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="backup-code">Backup Code</Label>
                  <Input
                    id="backup-code"
                    type="text"
                    value={backupCode}
                    onChange={(e) => handleCodeChange(e.target.value, 'backup')}
                    placeholder="XXXXXXXXXX"
                    maxLength={10}
                    className="font-mono uppercase"
                    autoComplete="off"
                    data-testid="input-backup-code"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one of your saved backup codes
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={isPending}
                    data-testid="button-cancel-backup"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isPending || backupCode.length < 8}
                    data-testid="button-verify-backup"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify
                        <CheckCircle className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        {mode === 'login' && (
          <div className="text-center">
            <Button
              variant="link"
              className="text-xs"
              onClick={() => {
                toast({
                  title: 'Lost Access?',
                  description: 'Please contact support to recover your account',
                });
              }}
              data-testid="button-lost-access"
            >
              Lost access to your authenticator?
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}