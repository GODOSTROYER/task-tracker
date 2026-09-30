'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authFieldClassName } from '@/components/auth-shell';

export function PasswordField({ className = '', ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={`${authFieldClassName} pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        disabled={props.disabled}
        aria-label={`${visible ? 'Hide' : 'Show'} password`}
        aria-controls={props.id}
        aria-pressed={visible}
        title={`${visible ? 'Hide' : 'Show'} password`}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-[6px] text-[#68717f] hover:text-[#171b22] focus-visible:outline-2 focus-visible:outline-[#087f70] disabled:opacity-50"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
