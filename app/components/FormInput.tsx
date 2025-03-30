'use client';

import React, { useState, useEffect } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { FaExclamationCircle, FaCheckCircle, FaEye, FaEyeSlash } from 'react-icons/fa';

interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

interface FormInputProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  validationRules?: ValidationRule[];
  validateOnBlur?: boolean;
  autoComplete?: string;
  className?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  validationRules = [],
  validateOnBlur = true,
  autoComplete,
  className = '',
}) => {
  const { theme } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (touched || !validateOnBlur) {
      validateInput(value);
    }
  }, [value, touched]);

  const validateInput = (value: string) => {
    if (required && !value) {
      setError('This field is required');
      setIsValid(false);
      return;
    }

    for (const rule of validationRules) {
      if (!rule.test(value)) {
        setError(rule.message);
        setIsValid(false);
        return;
      }
    }

    setError(null);
    setIsValid(true);
  };

  const handleBlur = () => {
    setTouched(true);
    if (validateOnBlur) {
      validateInput(value);
    }
  };

  const inputClasses = `
    block w-full px-4 py-2 rounded-md
    ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
    ${isDark ? 'border-gray-600' : 'border-gray-300'}
    ${error ? (isDark ? 'border-red-500' : 'border-red-500') : ''}
    ${isValid && touched ? (isDark ? 'border-green-500' : 'border-green-500') : ''}
    focus:outline-none focus:ring-2
    ${error
      ? 'focus:ring-red-500'
      : isDark
        ? 'focus:ring-blue-500'
        : 'focus:ring-blue-500'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `;

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className={`block mb-2 text-sm font-medium ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type === 'password' && showPassword ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={inputClasses}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        )}
        {error && touched && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
            <FaExclamationCircle />
          </div>
        )}
        {isValid && touched && !error && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
            <FaCheckCircle />
          </div>
        )}
      </div>
      {error && touched && (
        <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default FormInput; 