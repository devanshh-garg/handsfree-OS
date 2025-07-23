'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Mic, 
  Users, 
  BarChart3, 
  ChefHat,
  Smartphone,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { VoiceButton } from '@/components/voice/VoiceButton';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to dashboard after a delay for demo purposes
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  const features = [
    {
      icon: Mic,
      title: 'Voice Commands',
      titleHindi: 'आवाज़ कमांड',
      description: 'Control everything with Hindi/English voice commands',
      color: 'text-saffron'
    },
    {
      icon: BarChart3,
      title: 'Owner Dashboard',
      titleHindi: 'मालिक डैशबोर्ड',
      description: 'Real-time analytics and restaurant insights',
      color: 'text-emerald'
    },
    {
      icon: ChefHat,
      title: 'Kitchen Display',
      titleHindi: 'किचन डिस्प्ले',
      description: 'Voice-controlled order management for chefs',
      color: 'text-gold'
    },
    {
      icon: Smartphone,
      title: 'Waiter App',
      titleHindi: 'वेटर ऐप',
      description: 'Mobile-first interface for table service',
      color: 'text-crimson'
    }
  ];

  return (
    <div className="min-h-screen bg-background pattern-bg overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-saffron/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative container mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo/Title */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <h1 className="text-6xl font-bold text-foreground mb-4">
                श्री गणेश भोजनालय
              </h1>
              <div className="text-2xl text-saffron font-semibold mb-2">
                AI Restaurant Management System
              </div>
              <p className="text-lg text-foreground-muted">
                Voice-first architecture for modern Indian restaurants
              </p>
            </motion.div>

            {/* Voice Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-12 flex justify-center"
            >
              <VoiceButton size="lg" showStatus />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-wrap justify-center gap-4 mb-16"
            >
              {[
                { label: 'Dashboard', labelHindi: 'डैशबोर्ड', href: '/dashboard', icon: BarChart3 },
                { label: 'Kitchen', labelHindi: 'किचन', href: '/kitchen', icon: ChefHat },
                { label: 'Waiter', labelHindi: 'वेटर', href: '/waiter', icon: Users },
                { label: 'Menu', labelHindi: 'मेन्यू', href: '/menu', icon: QrCode }
              ].map((item, index) => (
                <motion.button
                  key={item.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  onClick={() => router.push(item.href)}
                  className="glass glass-hover px-6 py-4 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-saffron group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">
                        {item.label}
                      </div>
                      <div className="text-sm text-foreground-muted font-devanagari">
                        {item.labelHindi}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1 }}
                className="glass glass-hover p-6 rounded-lg text-center group"
              >
                <div className={`w-12 h-12 mx-auto mb-4 rounded-lg bg-current/10 flex items-center justify-center ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-foreground-muted font-devanagari mb-2">
                  {feature.titleHindi}
                </p>
                <p className="text-xs text-foreground-muted">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Auto-redirect Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-center mt-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-saffron/20 rounded-full text-saffron text-sm">
              <div className="w-2 h-2 bg-saffron rounded-full animate-pulse" />
              <span>Redirecting to dashboard in a few seconds...</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
}
