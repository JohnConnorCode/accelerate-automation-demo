import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  description?: string;
}

export const navigationItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', description: 'Overview & metrics' },
  { path: '/content-queue', label: 'Content Queue', description: 'Review & approve content' },
  { path: '/analytics', label: 'Analytics', description: 'Performance insights' },
  { path: '/settings', label: 'Settings', description: 'System configuration' },
];

interface NavigationProps {
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
  showDescriptions?: boolean;
}

export default function Navigation({
  className = '',
  linkClassName = 'text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium',
  activeClassName = 'text-indigo-600 bg-indigo-50',
  showDescriptions = false
}: NavigationProps) {
  const location = useLocation();

  return (
    <nav className={className}>
      {navigationItems.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`${linkClassName} ${isActive ? activeClassName : ''}`}
          >
            {item.label}
            {showDescriptions && item.description && (
              <span className="block text-xs text-gray-500">{item.description}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}