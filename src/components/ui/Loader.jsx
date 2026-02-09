import React, { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

export const Loader = () => {
    const { active, progress, errors, item, loaded, total } = useProgress();
    const [shouldShow, setShouldShow] = useState(true);

    useEffect(() => {
        if (progress === 100) {
            // Add a small delay for the "100%" to be visible and feel premium
            const timer = setTimeout(() => {
                setShouldShow(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [progress]);

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="fixed inset-0 z-[999] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
                >
                    {/* Background Tech Pattern (Subtle) */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#00f0ff_0%,_transparent_70%)] animate-pulse" />
                        <div className="grid grid-cols-12 h-full w-full border-white/5 divide-x divide-white/5">
                            {[...Array(12)].map((_, i) => <div key={i} />)}
                        </div>
                    </div>

                    {/* Central Content */}
                    <div className="relative z-10 flex flex-col items-center">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mb-8 text-center"
                        >
                            <h1 className="text-4xl font-bold font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                                INITIALIZING <span className="text-cyan-400">CORE</span>
                            </h1>
                            <p className="text-xs text-cyan-400/50 font-mono tracking-[0.3em] uppercase mt-2">
                                System Status: Downloading Assets
                            </p>
                        </motion.div>

                        {/* Progress Bar Container */}
                        <div className="w-64 h-[2px] bg-white/10 relative overflow-hidden rounded-full">
                            <motion.div
                                className="absolute top-0 left-0 h-full bg-cyan-400 shadow-[0_0_15px_#22d3ee]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: "spring", damping: 20, stiffness: 50 }}
                            />
                        </div>

                        {/* Percentage Text */}
                        <div className="mt-4 flex flex-col items-center">
                            <span className="text-4xl font-bold font-mono text-white/90">
                                {Math.round(progress)}<span className="text-cyan-400 text-xl">%</span>
                            </span>
                            <motion.p
                                key={item}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-gray-500 font-mono mt-2 truncate max-w-xs uppercase tracking-widest"
                            >
                                {item ? `fetching: ${item.split('/').pop()}` : 'Preparing modules...'}
                            </motion.p>
                        </div>
                    </div>

                    {/* Footer decoration */}
                    <div className="absolute bottom-10 left-10 flex gap-4 text-[10px] font-mono text-white/20">
                        <div>TX-2026-V1</div>
                        <div>|</div>
                        <div>ENCRYPT_SECURE</div>
                    </div>

                    <div className="absolute bottom-10 right-10 flex gap-2">
                        {[...Array(3)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                className="w-1 h-1 bg-cyan-400 rounded-full"
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
