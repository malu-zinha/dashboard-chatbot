import React from 'react'
import { LucideIcon, Maximize2 } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  onClick?: () => void
  onExpand?: () => void
}

const colorClasses = {
  primary: 'from-tecpred-primary via-tecpred-secondary to-tecpred-primary',
  success: 'from-success to-green-600',
  warning: 'from-tecpred-orange to-tecpred-coral',
  danger: 'from-danger to-red-600',
  info: 'from-tecpred-primary to-tecpred-secondary',
}

const iconBgClasses = {
  primary: 'bg-tecpred-orange bg-opacity-20',
  success: 'bg-green-100',
  warning: 'bg-tecpred-orange bg-opacity-20',
  danger: 'bg-red-100',
  info: 'bg-tecpred-primary bg-opacity-20',
}

const iconColorClasses = {
  primary: 'text-tecpred-orange',
  success: 'text-success',
  warning: 'text-tecpred-orange',
  danger: 'text-danger',
  info: 'text-tecpred-primary',
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  trend,
  trendValue,
  onClick,
  onExpand,
}: KPICardProps) {
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <div
      className={`relative bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 animate-fade-in ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      }`}
    >
      <Wrapper onClick={onClick} className="block w-full text-left">
        <div className={`h-2 bg-gradient-to-r ${colorClasses[color]}`}></div>

        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                {title}
              </p>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {value}
              </h3>
              {subtitle && (
                <p className="text-sm text-gray-500">
                  {subtitle}
                </p>
              )}

              {trend && trendValue && (
                <div className="mt-2 flex items-center space-x-1">
                  <span className={`text-xs font-semibold ${
                    trend === 'up' ? 'text-success' :
                    trend === 'down' ? 'text-danger' :
                    'text-gray-500'
                  }`}>
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                  </span>
                </div>
              )}

              {onClick && (
                <div className="mt-3 text-xs text-tecpred-primary font-medium">
                  Clique para ver detalhes →
                </div>
              )}
            </div>

            <div className={`p-3 rounded-lg ${iconBgClasses[color]}`}>
              <Icon className={`w-6 h-6 ${iconColorClasses[color]}`} />
            </div>
          </div>
        </div>
      </Wrapper>

      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Expandir ${title} em tela cheia`}
          className="absolute bottom-3 right-3 p-2 rounded-lg text-gray-400 hover:text-tecpred-primary hover:bg-gray-100 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

