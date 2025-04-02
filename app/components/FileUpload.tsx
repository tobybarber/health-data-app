'use client';

import React, { useCallback, useState } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { FaUpload, FaFile, FaTrash } from 'react-icons/fa';
import { SiJsonwebtokens } from "react-icons/si";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileRemoved?: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
}

interface FileWithPreview extends File {
  preview?: string;
  isFhir?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onFileRemoved,
  accept = '*/*',
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  className = '',
}) => {
  const { theme } = usePreferences();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Function to validate FHIR JSON format
  const validateFhirJson = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Basic FHIR R4 validation
      if (json.resourceType === 'Bundle') {
        // Validate Bundle
        const isValid = 
          json.type && // Must have bundle type
          Array.isArray(json.entry) && // Must have entries array
          json.entry.every((entry: any) => 
            entry.resource && 
            entry.resource.resourceType && 
            typeof entry.resource.resourceType === 'string'
          );
        
        return isValid;
      } else {
        // Validate single resource
        const isValid = 
          json.resourceType && // Must have resourceType
          typeof json.resourceType === 'string';
        
        return isValid;
      }
    } catch (e) {
      return false;
    }
  };

  const validateFile = async (file: File): Promise<string | null> => {
    if (file.size > maxSize) {
      return `File ${file.name} is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`;
    }

    if (accept !== '*/*') {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type || '';
      const fileExtension = `.${file.name.split('.').pop()}`;
      
      if (!acceptedTypes.some(type => 
        fileType.startsWith(type.replace('*', '')) || 
        type.endsWith(fileExtension)
      )) {
        return `File ${file.name} is not an accepted file type.`;
      }
    }

    // Additional validation for JSON files
    if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
      const isFhir = await validateFhirJson(file);
      if (!isFhir) {
        return `File ${file.name} is not a valid FHIR R4 JSON file.`;
      }
      (file as FileWithPreview).isFhir = true;
    }

    return null;
  };

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles) return;

    const fileArray = Array.from(newFiles);
    const totalFiles = files.length + fileArray.length;

    if (totalFiles > maxFiles) {
      setError(`Maximum number of files (${maxFiles}) exceeded.`);
      return;
    }

    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    // Process files sequentially to handle async validation
    for (const file of fileArray) {
      const error = await validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        const fileWithPreview = file as FileWithPreview;
        if (file.type.startsWith('image/')) {
          fileWithPreview.preview = URL.createObjectURL(file);
        }
        validFiles.push(fileWithPreview);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    onFilesSelected(validFiles);
    setError(null);
  }, [files, maxFiles, maxSize, accept, onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((fileToRemove: FileWithPreview) => {
    setFiles(prev => prev.filter(f => f !== fileToRemove));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    if (onFileRemoved) {
      onFileRemoved(fileToRemove);
    }
  }, [onFileRemoved]);

  const dropzoneClasses = `
    relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
    ${isDragging ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : ''}
    ${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}
    ${className}
  `;

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={dropzoneClasses}
      >
        <input
          type="file"
          onChange={(e) => handleFiles(e.target.files)}
          accept={accept}
          multiple={multiple}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="space-y-2">
          <FaUpload className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Drag and drop files here, or click to select files
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Maximum file size: {maxSize / 1024 / 1024}MB
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Supported formats: PDF, JPG, PNG, FHIR R4 JSON
          </p>
        </div>
      </div>

      {error && (
        <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className={`flex items-center justify-between p-2 rounded ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                {file.preview ? (
                  <img src={file.preview} alt={file.name} className="h-8 w-8 object-cover rounded" />
                ) : file.isFhir ? (
                  <SiJsonwebtokens className={`h-6 w-6 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                ) : (
                  <FaFile className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                )}
                <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  {file.name}
                  {file.isFhir && (
                    <span className={`ml-2 text-xs px-2 py-1 rounded ${
                      isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                      FHIR R4
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={() => removeFile(file)}
                className={`p-1 rounded-full hover:bg-opacity-10 ${
                  isDark ? 'hover:bg-red-500 text-red-400' : 'hover:bg-red-100 text-red-500'
                }`}
              >
                <FaTrash className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileUpload; 