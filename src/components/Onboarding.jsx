import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Leaf, Shield, ArrowRight, Check, Settings, IndianRupee, Link } from 'lucide-react';

const INTERESTS = [
  { id: 'productivity', label: 'Productivity', icon: Settings, color: 'from-purple-600 to-purple-400' },
  { id: 'sustainability', label: 'Sustainability', icon: Leaf, color: 'from-green-600 to-green-400' },
  { id: 'cost', label: 'Cost', icon: IndianRupee, color: 'from-yellow-600 to-yellow-400' },
  { id: 'safety', label: 'Safety', icon: Shield, color: 'from-red-600 to-red-400' },
  { id: 'reliability', label: 'Reliability', icon: Link, color: 'from-teal-600 to-teal-400' },
];

export const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);

  const toggleInterest = (id) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step === 1 && name.trim()) setStep(2);
    else if (step === 2 && selectedInterests.length > 0) {
      const userData = {
        name,
        interests: selectedInterests,
        onboardedAt: new Date().toISOString()
      };
      localStorage.setItem('techex_user', JSON.stringify(userData));
      onComplete(userData);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-900/20 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Welcome to TechEx
                </h2>
                <p className="text-gray-300">Before we begin, what should I call you?</p>
              </div>

              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-400 transition-colors" size={20} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Your Name"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-4 pl-12 pr-4 text-xl outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white placeholder-gray-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                />
              </div>

              <button
                disabled={!name.trim()}
                onClick={handleNext}
                className="w-full py-4 bg-gradient-to-r from-teal-600 to-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 text-white"
              >
                Next Step <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">What interests you, {name}?</h2>
                <p className="text-gray-300">Select at least one category to personalize your tour.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {INTERESTS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleInterest(item.id)}
                    className={`relative p-4 rounded-2xl border transition-all text-left group ${selectedInterests.includes(item.id)
                      ? 'bg-zinc-800 border-teal-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 shadow-lg`}>
                      <item.icon size={20} className="text-white" />
                    </div>
                    <span className="font-medium text-sm block leading-tight text-white">{item.label}</span>
                    {selectedInterests.includes(item.id) && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-black font-bold" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                disabled={selectedInterests.length === 0}
                onClick={handleNext}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-white"
              >
                Finish Onboarding <Check size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
