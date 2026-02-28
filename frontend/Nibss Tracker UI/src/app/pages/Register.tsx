import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { KeyRound, User, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import apiService from '@/services/apiService';

export const Register = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: ''
    });

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError('Invalid or missing invitation token');
                setIsLoading(false);
                return;
            }

            try {
                const response: any = await apiService.validateInvite(token);
                setEmail(response.email);
            } catch (err) {
                setError('Invalid or expired invitation token');
            } finally {
                setIsLoading(false);
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            if (!token) throw new Error("No token");

            await apiService.registerUser({
                token,
                firstName: formData.firstName,
                lastName: formData.lastName,
                password: formData.password
            });

            // Show success and redirect
            navigate('/login?registered=true');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-background p-4">
                <div className="bg-card p-6 sm:p-8 rounded-xl shadow-lg max-w-sm w-full text-center border border-border">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <span className="text-xl sm:text-2xl">⚠️</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1 sm:mb-2">Invitation Error</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-green-600 hover:text-green-700 font-medium text-xs sm:text-sm"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col lg:flex-row bg-background">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-green-600 p-8 lg:p-12 flex-col justify-between relative overflow-hidden">
                {/* Background Patterns */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 0 L100 100 L0 100 Z" fill="white" />
                    </svg>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 sm:gap-3 text-white/90 mb-8 lg:mb-12">
                        <div className="w-7 h-7 lg:w-8 lg:h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="font-bold text-white text-sm lg:text-base">N</span>
                        </div>
                        <span className="font-semibold tracking-wide text-sm lg:text-base">NIBSS Ticket Tracker</span>
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 lg:mb-6 leading-tight">
                            Join the<br />Team
                        </h1>
                        <p className="text-green-100 text-sm lg:text-base leading-relaxed">
                            Complete your registration to access the NIBSS development tracking system and collaborate with your team.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 text-green-100 text-xs lg:text-sm">
                    © 2026 NIBSS. All rights reserved.
                </div>
            </div>

            {/* Right Panel - Registration Form */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
                <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
                    <div className="flex flex-col gap-1 sm:gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Set up your account</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Please complete your profile details below
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                        <div className="space-y-3 sm:space-y-4">
                            {/* Email (Readonly) */}
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        disabled
                                        className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 bg-muted/30 border border-border text-muted-foreground rounded-lg text-xs sm:text-sm"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <CheckCircle2 className="h-3 h-3 sm:h-4 sm:w-4 text-green-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Name Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">First Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        className="block w-full px-3 py-2 sm:py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-xs sm:text-sm"
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">Last Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        className="block w-full px-3 py-2 sm:py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-xs sm:text-sm"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            {/* Password Fields */}
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">Create Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-green-500 transition-colors" />
                                    </div>
                                    <input
                                        required
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-xs sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-green-500 transition-colors" />
                                    </div>
                                    <input
                                        required
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-xs sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-2 sm:p-3 rounded-lg bg-red-50 border border-red-100 text-xs sm:text-sm text-red-600 flex items-center gap-2">
                                <span className="font-bold">Error:</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 sm:py-2.5 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20 text-sm sm:text-base"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            ) : (
                                <>
                                    Complete Registration
                                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
