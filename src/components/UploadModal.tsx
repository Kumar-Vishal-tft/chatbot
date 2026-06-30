'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, File, Shield, CheckCircle2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (fileName: string, extractedProfile?: any, analysisSummary?: string, type?: 'report' | 'prescription') => void;
  uploadType?: 'report' | 'prescription';
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess, uploadType = 'report' }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setIsCompleted(false);
    setErrorMessage(null);
    setPasswordRequired(false);
    setPassword('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsCompleted(false);
      setErrorMessage(null);
      setPasswordRequired(false);
      setPassword('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsCompleted(false);
      setErrorMessage(null);
      setPasswordRequired(false);
      setPassword('');
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(15);

    // Simulate progress while the backend classifies the document
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 10;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (password) {
        formData.append('password', password);
      }

      try {
        const store = useChatStore.getState();
        const sessionId = store.sessionId || store.activeChatId || '';
        if (sessionId) {
          formData.append('sessionId', sessionId);
        }
        formData.append('uploadType', uploadType);
      } catch (err) {
        console.warn('Failed to append sessionId to upload form:', err);
      }

      const response = await fetch('/api/classify', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to classify document');
      }

      const data = await response.json();
      
      if (data.is_password_protected === true) {
        setIsUploading(false);
        setUploadProgress(0);
        setPasswordRequired(true);
        if (password) {
          setErrorMessage('Incorrect password. Please try again.');
        } else {
          setErrorMessage(data.message || 'This file is password-protected. Please enter the password.');
        }
        return;
      }

      if (data.is_medical_document === true) {
        setUploadProgress(100);
        setIsCompleted(true);
        
        // Complete upload, invoke success, and close modal
        setTimeout(() => {
          onUploadSuccess(selectedFile.name, data.extracted_profile, data.analysis_summary, uploadType);
          resetState();
          onClose();
        }, 900);
      } else {
        setIsUploading(false);
        setUploadProgress(0);
        setErrorMessage(
          data.document_type
            ? `Rejected: The document was classified as a "${data.document_type}" which is not a valid medical report. Please upload a medical document.`
            : 'Rejected: This file does not appear to be a medical report or document. Please upload a valid medical document.'
        );
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMessage(err.message || 'An error occurred during file classification.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 backdrop-blur-sm p-4 flex justify-center items-start md:items-center py-6 md:py-10">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#0c0c0c] border border-black/10 dark:border-white/10 p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-[#111111] dark:text-white">
            {/* Close Button */}
            <button
              onClick={() => {
                onClose();
                resetState();
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#666] dark:text-[#aaa] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title & Icon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/15 flex items-center justify-center text-[#111111] dark:text-white flex-shrink-0">
                <Upload className="w-5 h-5 stroke-[2px]" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight leading-none">
                  {uploadType === 'prescription' ? 'Upload Prescription' : 'Upload Lab Report'}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {uploadType === 'prescription'
                    ? 'HIPAA compliant prescription analysis & safety check'
                    : 'HIPAA compliant automated biomarker analysis'}
                </p>
              </div>
            </div>

            {/* Inline Error Message */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400 flex items-start gap-2 animate-fade-in">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center font-bold">!</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-black/20 dark:hover:border-white/20 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center gap-2.5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition duration-200 mt-4 cursor-pointer text-center relative overflow-hidden"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                 accept=".pdf,.png,.jpg,.jpeg,.tiff,.doc,.docx,.webp"
                className="hidden"
              />

              {isUploading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-3 w-full px-4">
                  <div className="w-full bg-neutral-100 dark:bg-neutral-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-black dark:bg-white h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Classifying document ({uploadProgress}%)</span>
                </div>
              ) : isCompleted ? (
                <div className="flex flex-col items-center justify-center gap-2 py-3 text-emerald-500">
                  <CheckCircle2 className="w-8 h-8 stroke-[2]" />
                  <span className="text-xs font-bold">Upload Complete! Ready to analyze.</span>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center justify-center gap-2 py-1">
                  <File className="w-7 h-7 text-neutral-600 dark:text-neutral-400 stroke-[1.5]" />
                  <span className="text-xs font-bold max-w-[260px] truncate text-neutral-800 dark:text-neutral-200">{selectedFile.name}</span>
                  <span className="text-[10px] text-neutral-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-neutral-400 dark:text-neutral-600 stroke-[1.5]" />
                  <div>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">Click to select file or drag & drop</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Supports PDF, DOC, DOCX, PNG, JPG, JPEG, WEBP, TIFF</span>
                  </div>
                </>
              )}
            </div>

            {/* Password Input (only if passwordRequired) */}
            {passwordRequired && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 flex flex-col gap-2 animate-fade-in">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Document Password</span>
                <input
                  type="password"
                  placeholder="Enter PDF password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUploadSubmit();
                    }
                  }}
                  className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500 transition text-black dark:text-white"
                />
              </div>
            )}

            {/* Technical Specifications */}
            <div className="mt-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-100 dark:border-neutral-900 rounded-2xl p-3.5 flex flex-col gap-2.5">
              <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">File Specifications</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[9px] text-neutral-450 dark:text-neutral-500">Allowed Formats</span>
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-0.5">PDF, DOC, DOCX, JPEG, PNG, WEBP, TIFF</span>
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-450 dark:text-neutral-500">Maximum File Size</span>
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-0.5">10 MB limit</span>
                </div>
              </div>
            </div>

            {/* Usage & Entitlements Info */}
            <div className="mt-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-500/20 rounded-2xl p-3.5 flex flex-col gap-2 animate-fade-in">
              <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Usage & Entitlements</h4>
              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <span className="block text-[9px] text-neutral-400 dark:text-neutral-500 uppercase">Free Tier Limits</span>
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-0.5">1 Report & 1 Prescription</span>
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-400 dark:text-neutral-500 uppercase">Program Members</span>
                  <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">Unlimited Uploads</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  resetState();
                }}
                disabled={isUploading}
                className="flex-1 h-10 rounded-full border border-neutral-200 dark:border-neutral-800 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploading || isCompleted || (passwordRequired && !password.trim())}
                className="flex-1 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {passwordRequired
                  ? 'Decrypt & Analyze'
                  : uploadType === 'prescription'
                  ? 'Analyze Prescription'
                  : 'Analyze Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
