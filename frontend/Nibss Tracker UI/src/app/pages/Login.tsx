import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { AlertCircle, Shield, Lock, Mail } from 'lucide-react';
import nibssLogo from '@/assets/Nibss_logo.png';
import building from '@/assets/building2.jpg';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      const message = err.message || 'Invalid credentials. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={building}
          alt="NIBSS Building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/90 to-green-700/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 xl:px-24 text-white">
          <Shield className="w-12 lg:w-16 h-12 lg:h-16 mb-4 lg:mb-6" />
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 lg:mb-4">IT Governance</h1>
          <p className="text-base lg:text-lg xl:text-xl mb-6 lg:mb-8 text-green-50">IT Operations Management</p>
          <div className="space-y-3 lg:space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 lg:w-12 h-10 lg:h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 lg:w-6 h-5 lg:h-6" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">Secure Access</p>
                <p className="text-xs lg:text-sm text-green-100">Enterprise-grade security</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 lg:w-12 h-10 lg:h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 lg:w-6 h-5 lg:h-6" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">Compliance Tracking</p>
                <p className="text-xs lg:text-sm text-green-100">SLA monitoring, Incidents & Development</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 sm:px-6 py-8 sm:py-12 lg:py-0 overflow-y-auto">
        <div className="w-full max-w-xs sm:max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <img
              src={nibssLogo}
              alt="NIBSS Logo"
              className="h-12 sm:h-16 lg:h-20 w-auto mx-auto mb-4 sm:mb-6"
            />
            <h2 className="text-2xl sm:text-3xl lg:text-3xl font-bold text-foreground mb-1 sm:mb-2">Welcome Back</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Sign in to access your dashboard</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-lg lg:shadow-xl border-0">
            <CardContent className="pt-4 sm:pt-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@nibss-plc.com.ng"
                      className="pl-9 sm:pl-10 h-9 sm:h-12 text-sm border-gray-300 focus:border-green-600 focus:ring-green-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-9 sm:pl-10 h-9 sm:h-12 text-sm border-gray-300 focus:border-green-600 focus:ring-green-600"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 sm:h-12 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white font-semibold shadow-lg text-sm sm:text-base"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Protected by NIBSS IT Governance
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8">
            © 2025 Nigeria Inter-Bank Settlement System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
