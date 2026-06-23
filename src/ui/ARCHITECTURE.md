# AI Factory UI - React 19 App Structure

Created React 19 app structure with Vite in `src/ui/` directory.

## Structure Created

```
src/ui/
├── .storybook/          # Storybook configuration
│   ├── main.ts
│   └── preview.ts
├── components/          # UI components (existing)
│   ├── controls/
│   ├── forms/
│   ├── layout/
│   └── ui/
├── pages/               # Page components
│   ├── App.tsx
│   └── index.ts
├── hooks/               # Custom React hooks
│   └── index.ts
├── services/            # Business logic services
│   └── index.ts
├── theme/               # Theme configuration
│   ├── cyberpunk-aether.ts
│   ├── types.ts
│   └── index.ts
├── styles/              # Global styles
│   ├── globals.css
│   └── tailwind.config.js
├── __stories__/         # Storybook stories
├── __tests__/           # React Testing Library tests
├── utils/               # Utility functions (existing)
│   ├── accessibility.ts
│   ├── animations.ts
│   └── colors.ts
├── App.tsx              # Main application component
├── index.ts             # Library barrel export
├── main.tsx             # Application entry point
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript configuration
├── tsconfig.node.json   # Node-specific config
└── vite.config.ts       # Vite configuration
```

## Key Features

1. **React 19 + TypeScript** - Using latest React 19 features with full TypeScript support
2. **Vite 6.1** - Fast development server and production builds
3. **Tailwind CSS** - Cyberpunk theme with neon colors
4. **Storybook 8.5** - Component documentation and testing
5. **Vitest** - Unit testing framework
6. **ESM Modules** - All packages use ES module type

## Cyberpunk Theme Tokens

- **Colors**: Neon cyan (#00f3ff), magenta (#ff00ff), lime (#39ff14)
- **Shadows**: Glow effects with soft and hard shadows
- **Typography**: JetBrains Mono for code, Inter for UI, Oswald for display
- **Rounded Corners**: Cyber (12px 2px) and glitch (4px 12px) shapes

## Scripts Available

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Type checking
- `npm run lint` - ESLint check
- `npm run test` - Run tests
- `npm run storybook` - Start Storybook on port 6006

## Dependencies

**Runtime:**
- react@^19.0.0
- react-dom@^19.0.0

**Dev:**
- @types/react@^19.0.1
- @types/react-dom@^19.0.2
- tailwindcss@^3.4.17
- @tailwindcss/forms@^0.5.10
- storybook@^8.5.0
- vite@^6.1.0
- vitest@^2.1.9
- typescript@~5.6.2

## Notes

All files created and configured with strict TypeScript settings, ESM module type, and proper path aliases for imports.
