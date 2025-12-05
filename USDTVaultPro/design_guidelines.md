# BEP20 USDT Portfolio Management Platform - Design Guidelines

## Design Approach
**Reference-Based**: Drawing from Binance Pro, Coinbase Advanced, and Bloomberg Terminal aesthetics - dark-themed professional interfaces emphasizing data clarity, security, and institutional-grade financial visualization.

## Color System (Dark Theme)
- **Background Primary**: #0B0E11 (Deep charcoal) - Main app background
- **Background Secondary**: #161A1E (Dark grey) - Cards, elevated surfaces
- **Background Tertiary**: #1E2329 (Lighter grey) - Nested cards, hover states
- **Accent Gold**: #F0B90B - Key CTAs, highlights, portfolio gains
- **Success Green**: #0ECB81 - Positive values, profit indicators
- **Error Red**: #F6465D - Negative values, losses, alerts
- **Text Primary**: #EAECEF - Primary content, headings
- **Text Secondary**: #848E9C - Labels, secondary information
- **Text Tertiary**: #5E6673 - Metadata, timestamps
- **Border**: #2B3139 - Dividers, card borders
- **Chart Blue**: #3861FB - Secondary data visualization

## Typography
**Font Stack**: Inter, Roboto Mono (for numbers/addresses), system-ui

- **Display Numbers**: 48px/56px, Semi-bold - Total portfolio value
- **H1**: 28px/36px, Semi-bold - Dashboard sections
- **H2**: 20px/28px, Medium - Card headers
- **H3**: 16px/24px, Medium - Subsections
- **Body**: 14px/20px, Regular - Standard text
- **Small**: 12px/18px, Regular - Labels, metadata
- **Mono Numbers**: 16px/24px, Roboto Mono, Medium - USDT amounts, percentages
- **Mono Addresses**: 14px/20px, Roboto Mono, Regular - Wallet addresses, hashes

## Layout System
**Spacing**: Tailwind units 4, 6, 8, 12, 16, 20, 24
- **Container**: max-w-7xl, px-6 lg:px-8
- **Card Padding**: p-6 lg:p-8
- **Section Gaps**: space-y-6 lg:space-y-8
- **Grid Gaps**: gap-4 lg:gap-6

## Component Library

### Navigation
- **Top Bar**: Fixed header (bg-background-secondary/95 backdrop-blur) - Logo, network status (BSC badge), wallet address (truncated), total balance, profile menu
- **Sidebar** (Desktop): Collapsible nav with Dashboard, Transactions, Savings, Investments, Analytics, Settings icons + labels
- **Mobile**: Bottom sheet navigation

### Dashboard Layout
- **Portfolio Header**: Full-width hero section - Total Balance (48px display), 24h change (green/red with arrow), "Last updated" timestamp
- **Metrics Grid**: 4-column (desktop), 2-column (mobile) - Net Worth, Total Saved, Active Goals, YTD Return - each with large mono number, small label, trend indicator
- **Chart Section**: Area/line chart showing portfolio value over time - tabs for 24H, 7D, 30D, 90D, 1Y, ALL - gradient fills under curves
- **Quick Actions**: Horizontal row - Send, Receive, Add Savings Goal, Auto-Invest (gold buttons with icons)

### Cards
- **Standard Card**: bg-background-secondary, border border-border, rounded-xl, p-6
- **Stats Card**: Large mono number (text-primary), small label (text-secondary), percentage change badge (green/red pill)
- **Transaction Card**: Row layout - icon/type, address (truncated), amount (mono, right-aligned), timestamp, status badge

### Wallet Connection
- **Connected State**: Top right - Truncated address (0x1234...5678), BSC badge, balance, dropdown (View on BscScan, Disconnect)
- **Connect Button**: Large gold button with MetaMask/WalletConnect logos - shows in center of empty states

### Transactions Interface
- **Transaction Table**: Desktop - columns for Date, Type, Address, Amount, Status, Action (view details icon)
- **Mobile List**: Stacked cards with same info, tap to expand
- **Filters**: Dropdown for All/Sent/Received/Pending, date range picker
- **Send Modal**: Full-screen overlay - address input with validation, amount with max button, fee preview, two-step confirmation

### Savings Goals
- **Goal Card**: bg-background-secondary - Title (H3), target amount (mono), deadline, progress bar (gold fill, rounded-full, h-2), current/target ratio, edit/delete icons
- **Progress Section**: Visual timeline showing milestones, contribution history graph
- **Create Goal**: Modal with form - name input, target amount, deadline picker, optional recurring contribution toggle

### Investment Plans
- **Auto-Invest Card**: Plan name, investment amount (mono), frequency badge (Weekly/Monthly), next date, toggle switch (gold when active), performance sparkline
- **Calendar View**: Visual schedule of upcoming contributions

### Data Visualization
- **Charts**: Recharts/ApexCharts - dark theme, gold primary line, green/red fills, gridlines (#2B3139), tooltips (bg-background-tertiary)
- **Progress Bars**: h-2, rounded-full, bg-background-tertiary, gold fill
- **Trend Indicators**: Small arrows + percentage in colored pills

## Animations
Minimal only:
- **Hover**: Card shadow elevation (shadow-lg to shadow-xl/60)
- **Transitions**: duration-200 for colors, duration-300 for transforms
- **Loading**: Skeleton screens with subtle shimmer
- **Success**: Checkmark fade-in after transactions

## Icons
**Heroicons** (outline style for consistency)
- wallet, arrow-up, arrow-down, chart-bar-square, target, clock, cog-6-tooth, plus-circle, magnifying-glass, x-mark

## Accessibility
- WCAG AAA contrast for critical text (18:1+ on dark backgrounds)
- Focus rings: ring-2 ring-accent-gold ring-offset-2 ring-offset-background-primary
- All interactive elements keyboard accessible
- Screen reader labels for all icons and data visualizations

## Responsive Behavior
- **Mobile (< 768px)**: Single column, bottom nav, simplified charts, expandable cards
- **Tablet (768-1024px)**: 2-column grids, collapsible sidebar
- **Desktop (> 1024px)**: Multi-column dashboard (3-4 cols), persistent sidebar, full data tables

## Images
**No hero images** - This is a data-centric dashboard application. Use:
- Cryptocurrency logos (USDT, BNB) as small icons
- Empty state illustrations (minimal line art) for "No transactions yet", "Create your first goal"
- QR codes for receive addresses
- Placeholder avatar for user profile