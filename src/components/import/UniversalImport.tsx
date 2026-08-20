"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileType, CheckCircle, Loader2, AlertCircle, Database } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface UniversalImportProps {
  onSuccessCallback?: () => void;
}

export function UniversalImport({ onSuccessCallback }: UniversalImportProps) {
  const t = useTranslations("common");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isDirectImport, setIsDirectImport] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCounts, setImportedCounts] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulated progress when processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProgress(5);
      interval = setInterval(() => {
        setProgress((prev) => {
          // Slow down as it gets closer to 95%
          if (prev >= 95) return 95;
          const increment = Math.max(1, Math.floor((95 - prev) / 10));
          return prev + increment;
        });
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setError(null);
    setSuccess(false);
    setImportedCounts(null);
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setImportedCounts(null);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("directImport", String(isDirectImport));

      const response = await fetch("/api/universal-import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to process file");
      }

      setProgress(100);

      if (isDirectImport) {
        // Direct Database Import Success
        const data = await response.json();
        setImportedCounts(data.importedCounts || {});
        if (onSuccessCallback) {
          onSuccessCallback();
        }
      } else {
        // ZIP Download Success
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DukanKhata_Migration_${new Date().getTime()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      setSuccess(true);
      setFile(null);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
          {t("universalImportTitle") || "Universal Data Import"}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("universalImportDescription") || "Upload any software export (Excel, CSV, JSON, SQL) and AI will magically convert it into Dukan Khata format."}
        </p>
      </div>

      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg mb-6 border border-zinc-200 dark:border-zinc-700">
        <div className="space-y-0.5">
          <Label className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Direct Database Import
          </Label>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Automatically create records in your database instead of downloading a ZIP file.
          </p>
        </div>
        <Switch
          checked={isDirectImport}
          onCheckedChange={setIsDirectImport}
          disabled={isProcessing}
        />
      </div>

      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-12 transition-all duration-200 ease-in-out flex flex-col items-center justify-center cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-zinc-300 dark:border-zinc-700 hover:border-primary/50",
          file ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          className="hidden"
          disabled={isProcessing}
        />

        {file ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <FileType className="w-10 h-10 text-primary" />
            </div>
            <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[250px]">
              {file.name}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4">
              <UploadCloud className="w-10 h-10 text-zinc-500" />
            </div>
            <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
              {t("dragDropTitle") || "Drag & Drop your file here"}
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              {t("dragDropSubtitle") || "or click to browse from your computer"}
            </p>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="mt-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isDirectImport ? "Importing records using AI..." : "Generating ZIP using AI..."}
            </span>
            <span className="text-sm text-zinc-500">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              {isDirectImport ? "Import Successful!" : (t("successTitle") || "Success! ZIP file downloaded.")}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
              {isDirectImport 
                ? (
                    <span>
                      Data has been successfully imported into your database.
                      {importedCounts && Object.entries(importedCounts).map(([module, count]) => (
                        <span key={module} className="block mt-1 capitalize">• {module}: {count} records</span>
                      ))}
                    </span>
                  )
                : (t("successDescription") || "Please extract the ZIP and import the CSV files into their respective modules.")}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        {file && !isProcessing && (
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              setError(null);
              setSuccess(false);
              setImportedCounts(null);
              setProgress(0);
            }}
          >
            {t("cancel") || "Cancel"}
          </Button>
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleUpload();
          }}
          disabled={!file || isProcessing}
          className="min-w-[120px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("processing") || "Processing..."}
            </>
          ) : (
            t("processData") || "Process Data"
          )}
        </Button>
      </div>
    </div>
  );
}
