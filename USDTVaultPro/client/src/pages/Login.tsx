import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import TwoFactorVerifyModal from '@/components/TwoFactorVerifyModal';

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSignup, setIsSignup] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempToken, setTempToken] = useState<string>('');

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Add useEffect to monitor the current location
  useEffect(() => {
    console.log('Current location:', location);
  }, [location]);

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => 
      apiRequest(`/api/auth/${isSignup ? 'register' : 'login'}`, 'POST', data),
    onSuccess: (response) => {
      console.log('Login succeeded:', response);
      
      // Check if 2FA is required
      if (response.requires2FA) {
        console.log('2FA required, showing verification modal');
        setTempToken(response.tempToken);
        setShow2FAModal(true);
        toast({
          title: '2FA Required',
          description: 'Please enter your authentication code to continue',
        });
        return;
      }
      
      console.log('Current location before auth:', location);
      
      // Store token and user data
      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('userId', response.user.id);
      console.log('Token set in localStorage:', response.accessToken);
      
      // Dispatch custom event to notify useAuth hook about token change
      // This is crucial for the auth state to update immediately
      window.dispatchEvent(new Event('localStorageChange'));
      console.log('Auth state update event dispatched');
      
      // Show success toast
      toast({
        title: isSignup ? 'Account Created' : 'Login Successful',
        description: isSignup ? 'Welcome to USDT Savings!' : 'Welcome back!',
      });
      
      // Navigate immediately using setLocation
      console.log('Attempting navigation to / using setLocation');
      setLocation('/');
      
      // Also try a direct navigation as a guaranteed fallback
      // This ensures navigation happens even if wouter has issues
      console.log('Also triggering direct navigation via window.location');
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Authentication failed',
        variant: 'destructive',
      });
    },
  });

  // Mutation for 2FA login verification
  const verify2FAMutation = useMutation({
    mutationFn: (data: { tempToken: string; code: string; isBackupCode?: boolean }) =>
      apiRequest('/api/auth/2fa/login-verify', 'POST', data),
    onSuccess: (response) => {
      console.log('2FA verification succeeded:', response);
      
      // Store token and user data
      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('userId', response.user.id);
      
      // Dispatch custom event
      window.dispatchEvent(new Event('localStorageChange'));
      
      // Close modal and navigate
      setShow2FAModal(false);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      
      setLocation('/');
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast({
        title: '2FA Verification Failed',
        description: error.message || 'Invalid authentication code',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const handle2FAVerify = (code: string, isBackupCode?: boolean) => {
    verify2FAMutation.mutate({ tempToken, code, isBackupCode });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold">U</span>
            </div>
            <div>
              <CardTitle className="text-2xl">USDT Savings</CardTitle>
              <CardDescription>Portfolio Management Platform</CardDescription>
            </div>
          </div>
          <CardTitle>{isSignup ? 'Create Account' : 'Welcome Back'}</CardTitle>
          <CardDescription>
            {isSignup 
              ? 'Sign up to start managing your USDT portfolio'
              : 'Login to access your USDT savings account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your username" 
                        type="text" 
                        {...field} 
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="••••••••" 
                        type="password" 
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid={isSignup ? "button-signup" : "button-login"}
              >
                {loginMutation.isPending 
                  ? 'Loading...' 
                  : (isSignup ? 'Create Account' : 'Login')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-sm text-center text-muted-foreground">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
          </div>
          <Button
            variant="ghost"
            onClick={() => setIsSignup(!isSignup)}
            data-testid="button-toggle-auth"
          >
            {isSignup ? 'Login instead' : 'Sign up'}
          </Button>
        </CardFooter>
      </Card>

      <TwoFactorVerifyModal
        open={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onVerify={handle2FAVerify}
        mode="login"
      />
    </div>
  );
}