import { Activity, Zap, FileText } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: 'activity' | 'zap' | 'file';
}

export default function StatCard({ title, value, icon }: StatCardProps) {
  const iconMap = {
    activity: Activity,
    zap: Zap,
    file: FileText,
  };

  const Icon = iconMap[icon];

  return (
    <div className="spectre-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-spectre-muted text-sm font-medium mb-2">{title}</p>
          <p className="text-4xl font-bold text-spectre-accent">{value}</p>
        </div>
        <div className="p-2 bg-spectre-accent/10 rounded-lg">
          <Icon size={24} className="text-spectre-accent" />
        </div>
      </div>
    </div>
  );
}
