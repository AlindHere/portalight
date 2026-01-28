'use client';

import { useState, useRef, useEffect } from 'react';

interface DropdownOption {
    value: string;
    label: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export default function CustomDropdown({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    disabled = false,
}: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search query
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery(''); // Reset search on close
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className={className} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                style={{
                    height: '2.375rem',
                    padding: '0 2.25rem 0 0.875rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    backgroundColor: disabled ? '#f9fafb' : 'white',
                    color: disabled ? '#9ca3af' : '#374151',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    minWidth: '180px',
                    whiteSpace: 'nowrap',
                    textAlign: 'left',
                    position: 'relative',
                    width: '100%',
                    transition: 'border-color 0.15s ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                {selectedOption?.label || placeholder}
                <svg
                    style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
                        width: '1rem',
                        height: '1rem',
                        transition: 'transform 0.2s ease',
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#6b7280"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        width: '100%',
                        minWidth: '180px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Search Input */}
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: '0.375rem 0.5rem',
                                fontSize: '0.75rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.25rem',
                                outline: 'none',
                            }}
                        />
                    </div>

                    {/* Options List */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.5rem 0.875rem',
                                        fontSize: '0.8125rem',
                                        fontWeight: value === option.value ? 600 : 400,
                                        color: value === option.value ? '#3b82f6' : '#374151',
                                        backgroundColor: value === option.value ? '#eff6ff' : 'white',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.1s ease',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (value !== option.value) {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = value === option.value ? '#eff6ff' : 'white';
                                    }}
                                >
                                    {value === option.value && '✓ '}{option.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
