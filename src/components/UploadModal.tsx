'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, File, Shield, CheckCircle2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (fileName: string) => void;
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsCompleted(false);
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
    }
  };

  const handleUploadSubmit = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress(10);
    
    let currentProgress = 10;
    const timer = setInterval(() => {
      currentProgress += 30;
      if (currentProgress >= 100) {
        clearInterval(timer);
        setUploadProgress(100);
        setIsUploading(false);
        setIsCompleted(true);
        
        // Complete upload, invoke success exactly once, and close modal
        setTimeout(() => {
          onUploadSuccess(selectedFile.name);
          setSelectedFile(null);
          setIsCompleted(false);
          onClose();
        }, 900);
      } else {
        setUploadProgress(currentProgress);
      }
    }, 200);
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
                setSelectedFile(null);
                setIsCompleted(false);
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
                <h3 className="text-lg font-bold tracking-tight leading-none">Upload Lab Report</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">HIPAA compliant automated biomarker analysis</p>
              </div>
            </div>

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
                 accept=".pdf,.png,.jpg,.jpeg,.tiff"
                className="hidden"
              />

              {isUploading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-3 w-full px-4">
                  <div className="w-full bg-neutral-100 dark:bg-neutral-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-black dark:bg-white h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Uploading file ({uploadProgress}%)</span>
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
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Supports PDF, PNG, JPG, JPEG, TIFF</span>
                  </div>
                </>
              )}
            </div>

            {/* Technical Requirements / Grid */}
            <div className="mt-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-100 dark:border-neutral-900 rounded-2xl p-3.5 flex flex-col gap-2.5">
              <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">File Specifications</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[9px] text-neutral-450 dark:text-neutral-500">Allowed Formats</span>
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-0.5">PDF, JPEG, PNG, TIFF</span>
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-450 dark:text-neutral-500">Maximum File Size</span>
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-0.5">10 MB limit</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  setSelectedFile(null);
                  setIsCompleted(false);
                }}
                disabled={isUploading}
                className="flex-1 h-10 rounded-full border border-neutral-200 dark:border-neutral-800 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploading || isCompleted}
                className="flex-1 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze Report
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
