// Line icons from the design files (24×24, stroke-based).

type IconProps = { size?: number; stroke?: string; width?: number; style?: React.CSSProperties; className?: string };

function Svg({ size = 24, stroke = 'currentColor', width = 1.5, style, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  );
}

export const PhoneIcon = (p: IconProps) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></Svg>;
export const ChevronDown = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const ChevronRight = (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const ArrowRight = (p: IconProps) => <Svg {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Svg>;
export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Svg>;
export const Check = (p: IconProps) => <Svg width={2} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const Minus = (p: IconProps) => <Svg width={2} {...p}><path d="M5 12h14" /></Svg>;
export const Plus = (p: IconProps) => <Svg width={2} {...p}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>;
export const Lock = (p: IconProps) => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>;
export const Shield = (p: IconProps) => <Svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></Svg>;
export const Team = (p: IconProps) => <Svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5a3 3 0 010 6" /><path d="M18 14.5c1.8.8 3 2.5 3 4.5" /></Svg>;
export const Redo = (p: IconProps) => <Svg {...p}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" /></Svg>;
export const CalendarRepeat = (p: IconProps) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M15 14.5a3 3 0 11-1-2.2" /><path d="M15 11.5v1.5h-1.5" /></Svg>;
export const Calendar = (p: IconProps) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v4" /><path d="M16 3v4" /></Svg>;
export const Sparkle = (p: IconProps) => <Svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></Svg>;
export const Key = (p: IconProps) => <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M17 6l3 3" /><path d="M15 8l2 2" /></Svg>;
export const PhoneDevice = (p: IconProps) => <Svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></Svg>;
export const PhoneCheck = (p: IconProps) => <Svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10 10.5l1.5 1.5 2.5-3" /></Svg>;
export const Clipboard = (p: IconProps) => <Svg {...p}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 9l1.5 1.5L13 8" /><path d="M9 15h6" /></Svg>;
export const Paw = (p: IconProps) => <Svg {...p}><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 015 5v3.5a3.5 3.5 0 01-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 015.5 10z" /></Svg>;
export const Pin = (p: IconProps) => <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Svg>;
export const ImageIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Svg>;
export const Camera = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M8 5l1.5-2h5L16 5" /></Svg>;
