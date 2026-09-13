import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, FileImage } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';

export interface PaymentEvidenceUploaderProps {
    value?: File | null;
    onChange: (file: File | null) => void;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    label?: string;
    description?: string;
}

export function PaymentEvidenceUploader({
    value = null,
    onChange,
    error,
    disabled = false,
    required = false,
    label = 'Payment Evidence (Cheque / MO Scan)',
    description = 'Upload a clear JPEG photo/scan of the physical instrument. Max 5 MB.',
}: PaymentEvidenceUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);

    useEffect(() => {
        if (!value) {
            setPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(value);
        setPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [value]);

    const handleFileValidation = (file: File): boolean => {
        setClientError(null);

        // 1. Max size 5 MB
        const maxBytes = 5 * 1024 * 1024;
        if (file.size > maxBytes) {
            setClientError('File size exceeds 5 MB limit. Please compress or choose a smaller image.');
            return false;
        }

        // 2. MIME & extension validation
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (file.type !== 'image/jpeg' && ext !== 'jpg' && ext !== 'jpeg') {
            setClientError('Only JPEG image files (.jpg, .jpeg) are supported.');
            return false;
        }

        return true;
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const file = e.target.files?.[0];
        if (!file) return;

        if (handleFileValidation(file)) {
            onChange(file);
        } else {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled) return;

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        if (handleFileValidation(file)) {
            onChange(file);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        setClientError(null);
        onChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const triggerFileInput = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    const displayError = clientError || error;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
                {value && (
                    <Badge variant="success" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> JPEG Attached
                    </Badge>
                )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,.jpg,.jpeg"
                onChange={handleFileChange}
                disabled={disabled}
                className="hidden"
                id="payment-evidence-upload-input"
                aria-label={label}
            />

            {!value ? (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            triggerFileInput();
                        }
                    }}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-150 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        isDragging
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/80'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/60 rounded-full text-indigo-600 dark:text-indigo-400">
                            <Upload className="h-6 w-6" />
                        </div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
                                Click to browse
                            </span>{' '}
                            or drag and drop instrument photo
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Strictly JPEG only (.jpg / .jpeg) • Maximum 5 MB
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                    {previewUrl ? (
                        <div className="relative w-full sm:w-28 h-24 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0 flex items-center justify-center">
                            <img
                                src={previewUrl}
                                alt="Evidence Preview"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-full sm:w-28 h-24 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <FileImage className="h-8 w-8" />
                        </div>
                    )}

                    <div className="flex-1 min-w-0 w-full">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {value.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {(value.size / (1024 * 1024)).toFixed(2)} MB • {value.type || 'image/jpeg'}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={triggerFileInput}
                                disabled={disabled}
                                className="h-8 text-xs min-h-[36px]"
                            >
                                Change Image
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={handleRemove}
                                disabled={disabled}
                                className="h-8 text-xs min-h-[36px] gap-1"
                            >
                                <X className="h-3.5 w-3.5" /> Remove
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {displayError && (
                <div
                    role="alert"
                    className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-medium"
                >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{displayError}</span>
                </div>
            )}
        </div>
    );
}
