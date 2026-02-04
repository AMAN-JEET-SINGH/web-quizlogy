'use client';

import { useState, useEffect } from 'react';
import { feedbackApi } from '@/lib/api';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportIssueModal = ({ isOpen, onClose }: ReportIssueModalProps) => {
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [otherDescription, setOtherDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const issueOptions = [
    'It Stopped Working',
    'Delayed Loading',
    'Quiz Not Responding',
    'Instruction Not Clear',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) {
      alert('Please select an issue type');
      return;
    }
    
    const issueDescription = selectedIssue === 'Other' ? otherDescription : selectedIssue;
    
    if (selectedIssue === 'Other' && !otherDescription.trim()) {
      alert('Please describe the issue');
      return;
    }
    
    try {
      setSubmitting(true);
      await feedbackApi.sendReport({
        issueType: selectedIssue === 'Other' ? 'other' : selectedIssue.toLowerCase().replace(/\s+/g, '-'),
        description: issueDescription,
      });
      alert('Thank you for reporting the issue! We will investigate and get back to you soon.');
      
      // Reset form
      setSelectedIssue('');
      setOtherDescription('');
      onClose();
    } catch (err) {
      console.error('Error sending report:', err);
      alert('Failed to send report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`fixed bottom-0 w-full sm:w-[420px] md:w-[488px] bg-[#FFF6D9] rounded-t-3xl z-50 max-h-[70vh] flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h2 className="text-black text-xl font-bold">Report An Issue</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-black mb-6">What Kind Of Problem Have You Encountered?</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Radio Options */}
            <div className="space-y-4">
              {issueOptions.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="issue"
                    value={option}
                    checked={selectedIssue === option}
                    onChange={(e) => setSelectedIssue(e.target.value)}
                    className="w-5 h-5 appearance-none border-2 border-black rounded-full cursor-pointer focus:outline-none relative"
                    style={{
                      backgroundColor: selectedIssue === option ? '#FACC15' : 'transparent',
                      borderColor: selectedIssue === option ? '#0D0009' : '#0D0009',
                      backgroundImage: selectedIssue === option ? 'none' : 'none',
                    }}
                  />
                  <span className="text-black">{option}</span>
                </label>
              ))}
            </div>

            {/* Other Description Input */}
            {selectedIssue === 'Other' && (
              <div className="mt-4 border-3 border-black/10 rounded-lg p-2">
                <textarea
                  value={otherDescription}
                  onChange={(e) => setOtherDescription(e.target.value)}
                  placeholder="Please describe the issue..."
                  rows={4}
                  className="w-full bg-[#FFF6D9] text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none placeholder-black/30"
                  required={selectedIssue === 'Other'}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-400 text-black font-bold py-4 px-6 rounded-lg hover:bg-yellow-500 transition-colors mt-8 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            >
              <span className="relative z-10">{submitting ? 'Sending...' : 'Send Feedback'}</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-black/40 to-transparent shiny-effect"></span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

