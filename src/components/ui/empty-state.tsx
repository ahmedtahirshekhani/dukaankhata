import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  className,
  action
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500", className)}>
      <div className="bg-muted/50 p-4 rounded-full mb-4">
        {icon || <Inbox className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {title || "No data available"}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
