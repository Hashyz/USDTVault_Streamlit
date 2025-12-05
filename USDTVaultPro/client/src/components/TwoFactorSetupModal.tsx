import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield,
  QrCode,
  Copy,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Key,
  Eye,
  EyeOff,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { QRCodeSVG } from 'qrcode.react';

interface TwoFactorSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TwoFactorSetupModal({
  open,
  onClose,
  onSuccess,
}: TwoFactorSetupModalProps) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [qrData, setQrData] = useState<{
    qrCode: string;
    manualEntryKey: string;
    appName: string;
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPassword('');
      setVerificationCode('');
      setQrData(null);
      setBackupCodes([]);
      setShowPassword(false);
    }
  }, [open]);

  // Check current 2FA status
  const { data: status } = useQuery<{ enabled: boolean; hasBackupCodes: boolean }>({
    queryKey: ['/api/auth/2fa/status'],
    enabled: open,
  });

  // Setup 2FA mutation
  const setupMutation = useMutation({
    mutationFn: async (data: { password: string }) =>
      apiRequest('/api/auth/2fa/setup', 'POST', data),
    onSuccess: (data) => {
      // Validate the response data
      if (!data || !data.qrCode || !data.manualEntryKey) {
        toast({
          title: 'Setup Error',
          description: 'Invalid response from server. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      setQrData(data);
      setStep(2);
      setPassword(''); // Clear password for security
    },
    onError: (error: any) => {
      toast({
        title: 'Setup Failed',
        description: error.message || 'Failed to set up 2FA',
        variant: 'destructive',
      });
    },
  });

  // Verify code mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: { code: string }) =>
      apiRequest('/api/auth/2fa/verify', 'POST', data),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes || []);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/2fa/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast({
        title: 'Password Required',
        description: 'Please enter your password to continue',
        variant: 'destructive',
      });
      return;
    }
    setupMutation.mutate({ password });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }
    verifyMutation.mutate({ code: verificationCode });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const downloadBackupCodes = () => {
    const content = `USDT Savings - Two-Factor Authentication Backup Codes
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep these codes safe! Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Store these codes in a secure location.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usdt-savings-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: 'Backup codes saved to file',
    });
  };

  const handleComplete = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="modal-2fa-setup">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          </div>
          <DialogDescription>
            {step === 1 && 'Confirm your password to begin setup'}
            {step === 2 && 'Scan the QR code with your authenticator app'}
            {step === 3 && 'Save your backup codes in a safe place'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 mx-1 rounded-full ${
                s <= step ? 'bg-primary' : 'bg-secondary'
              }`}
              data-testid={`step-indicator-${s}`}
            />
          ))}
        </div>

        {/* Step 1: Password Confirmation */}
        {step === 1 && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Two-factor authentication adds an extra layer of security to your account.
                You'll need an authenticator app like Google Authenticator or Authy.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="password">Enter your password to continue</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="input-2fa-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-setup"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={setupMutation.isPending}
                data-testid="button-continue-setup"
              >
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: QR Code & Verification */}
        {step === 2 && qrData && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Scan QR Code</CardTitle>
                <CardDescription>
                  Use your authenticator app to scan this QR code
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  {qrData.qrCode ? (
                    <QRCodeSVG
                      value={qrData.qrCode}
                      size={180}
                      level="L"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center bg-muted rounded">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Or enter this key manually:
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                      {qrData.manualEntryKey}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(qrData.manualEntryKey, 'Manual key')}
                      data-testid="button-copy-key"
                    >
                      {copiedCode === qrData.manualEntryKey ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Enter Verification Code</CardTitle>
                <CardDescription>
                  Enter the 6-digit code from your authenticator app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest"
                  data-testid="input-verification-code"
                />
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-verify"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={verifyMutation.isPending || verificationCode.length !== 6}
                data-testid="button-verify-code"
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Enable
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Backup Codes */}
        {step === 3 && backupCodes.length > 0 && (
          <div className="space-y-4">
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Two-factor authentication has been enabled successfully!
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Backup Codes
                </CardTitle>
                <CardDescription>
                  Save these codes in a secure location. Each code can only be used once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md font-mono text-sm"
                      data-testid={`backup-code-${index + 1}`}
                    >
                      <span>{code}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(code, `Backup code ${index + 1}`)}
                      >
                        {copiedCode === code ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const allCodes = backupCodes.join('\n');
                      copyToClipboard(allCodes, 'All backup codes');
                    }}
                    data-testid="button-copy-all-codes"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={downloadBackupCodes}
                    data-testid="button-download-codes"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> These codes won't be shown again. Make sure you've saved them before closing this window.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={handleComplete} data-testid="button-complete-setup">
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}