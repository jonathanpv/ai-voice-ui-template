'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function ActionDialog({ isOpen, onClose, content }: ActionDialogProps) {
  const getDemoContent = (content: string) => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('slide') || lowerContent.includes('presentation')) {
      return (
        <div className="space-y-4">
          <p className="text-lg font-medium">Automated Slide Creation</p>
          <ul className="space-y-2 text-sm">
            <li>✨ Generate professional presentations from any content</li>
            <li>📊 Automatic data visualization and charts</li>
            <li>🎨 Smart design suggestions and templates</li>
            <li>🔄 Real-time collaboration features</li>
          </ul>
          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">Try it: &ldquo;Create a pitch deck for my startup&rdquo;</p>
          </div>
        </div>
      );
    }
    
    if (lowerContent.includes('outreach') || lowerContent.includes('email')) {
      return (
        <div className="space-y-4">
          <p className="text-lg font-medium">Smart Outreach Automation</p>
          <ul className="space-y-2 text-sm">
            <li>📧 Personalized email campaigns at scale</li>
            <li>🎯 AI-powered lead scoring and targeting</li>
            <li>📈 Response tracking and analytics</li>
            <li>🤝 CRM integration and follow-ups</li>
          </ul>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Example: &ldquo;Find leads in the SaaS industry and draft outreach&rdquo;</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <p className="text-lg font-medium">{content}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
            <p className="font-medium text-sm mb-1">Sales Automation</p>
            <p className="text-xs text-gray-600">Streamline your entire sales process</p>
          </div>
          <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
            <p className="font-medium text-sm mb-1">Team Productivity</p>
            <p className="text-xs text-gray-600">Coordinate and automate workflows</p>
          </div>
          <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
            <p className="font-medium text-sm mb-1">Data Analytics</p>
            <p className="text-xs text-gray-600">Insights and forecasting</p>
          </div>
          <div className="p-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg">
            <p className="font-medium text-sm mb-1">Document Processing</p>
            <p className="text-xs text-gray-600">Summarize and extract key info</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-w-[90vw] bg-white rounded-2xl shadow-2xl p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Slashly Demo</h3>
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="text-gray-700">
              {getDemoContent(content)}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}