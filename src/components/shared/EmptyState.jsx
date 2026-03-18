import { Button } from '@/components/ui/button';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 mb-5 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-[#1a5c38] hover:bg-[#134a2c]">{actionLabel}</Button>
      )}
    </div>
  );
}