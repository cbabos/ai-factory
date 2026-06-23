import React, { forwardRef, type HTMLAttributes } from 'react';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  columns?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'auto' | 'fr';
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  columnGap?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  rowGap?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  cyber?: boolean;
  glitchEffect?: boolean;
  minmax?: string;
  autoRows?: 'auto' | 'min' | 'max' | 'fr';
}

export interface GridItemProps {
  children?: React.ReactNode;
  span?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
  start?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'auto';
  end?: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | 'auto';
  rowSpan?: '1' | '2' | '3' | '4' | '5';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'stretch';
  order?: number;
  cyber?: boolean;
  className?: string;
}

const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    {
      children,
      columns = '3',
      gap = 'md',
      columnGap,
      rowGap,
      align = 'start',
      justify = 'start',
      cyber = false,
      glitchEffect = false,
      minmax = 'minmax(250px, 1fr)',
      autoRows = 'auto',
      className,
      ...props
    },
    ref
  ) => {
    const columnsClasses = {
      '1': 'grid-cols-1',
      '2': 'grid-cols-1 sm:grid-cols-2',
      '3': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      '4': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      '5': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      '6': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
      '7': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7',
      '8': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8',
      '9': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-9',
      '10': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-10',
      '11': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-11',
      '12': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12',
      auto: `repeat(auto-fill, ${minmax})`,
      fr: 'repeat(auto-fill, minmax(200px, 1fr))',
    };

    const gapClasses = {
      none: '',
      sm: 'gap-3',
      md: 'gap-6',
      lg: 'gap-8',
      xl: 'gap-10',
      '2xl': 'gap-12',
      '3xl': 'gap-16',
    };

    const columnGapClasses = {
      none: '',
      sm: 'gap-x-3',
      md: 'gap-x-6',
      lg: 'gap-x-8',
      xl: 'gap-x-10',
      '2xl': 'gap-x-12',
      '3xl': 'gap-x-16',
    };

    const rowGapClasses = {
      none: '',
      sm: 'gap-y-3',
      md: 'gap-y-6',
      lg: 'gap-y-8',
      xl: 'gap-y-10',
      '2xl': 'gap-y-12',
      '3xl': 'gap-y-16',
    };

    const alignClasses = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };

    const justifyClasses = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };

    const cyberGrid = cyber
      ? 'bg-[url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9InJnYmEoMCwgMjQzLCAyNTUsIDAuMDUpIi8+PC9zdmc+)] bg-[length:8px_8px] animate-[glitch-overlay_10s_infinite]'
      : '';

    const glitchClasses = glitchEffect
      ? 'animate-[glitch-overlay_6s_infinite]'
      : '';

    return (
      <div
        ref={ref}
        style={{
          ...(props.style ?? {}),
          gridAutoRows: autoRows === 'fr' ? 'minmax(0, 1fr)' : autoRows,
        }}
        className={`
          grid
          ${columnsClasses[columns]}
          ${gapClasses[gap]}
          ${columnGap ? columnGapClasses[columnGap] : ''}
          ${rowGap ? rowGapClasses[rowGap] : ''}
          ${alignClasses[align]}
          ${justifyClasses[justify]}
          ${cyberGrid}
          ${glitchClasses}
          ${className || ''}
        `}
        role="grid"
        aria-label="Cyberpunk Grid Layout"
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';

const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  (
    {
      children,
      span,
      start,
      end,
      rowSpan,
      align: alignSelf = 'start',
      justify: justifySelf = 'start',
      order,
      cyber = false,
      className,
      ...props
    },
    ref
  ) => {
    const spanClasses = {
      '1': 'col-span-1',
      '2': 'col-span-2',
      '3': 'col-span-3',
      '4': 'col-span-4',
      '5': 'col-span-5',
      '6': 'col-span-6',
      '7': 'col-span-7',
      '8': 'col-span-8',
      '9': 'col-span-9',
      '10': 'col-span-10',
      '11': 'col-span-11',
      '12': 'col-span-12',
    };

    const startClasses = {
      '1': 'col-start-1',
      '2': 'col-start-2',
      '3': 'col-start-3',
      '4': 'col-start-4',
      '5': 'col-start-5',
      '6': 'col-start-6',
      '7': 'col-start-7',
      '8': 'col-start-8',
      '9': 'col-start-9',
      '10': 'col-start-10',
      '11': 'col-start-11',
      '12': 'col-start-12',
      auto: 'col-start-auto',
    };

    const endClasses = {
      '2': 'col-end-2',
      '3': 'col-end-3',
      '4': 'col-end-4',
      '5': 'col-end-5',
      '6': 'col-end-6',
      '7': 'col-end-7',
      '8': 'col-end-8',
      '9': 'col-end-9',
      '10': 'col-end-10',
      '11': 'col-end-11',
      '12': 'col-end-12',
      '13': 'col-end-13',
      auto: 'col-end-auto',
    };

    const rowSpanClasses = {
      '1': 'row-span-1',
      '2': 'row-span-2',
      '3': 'row-span-3',
      '4': 'row-span-4',
      '5': 'row-span-5',
    };

    const alignSelfClasses = {
      start: 'self-start',
      center: 'self-center',
      end: 'self-end',
      stretch: 'self-stretch',
    };

    const justifySelfClasses = {
      start: 'justify-self-start',
      center: 'justify-self-center',
      end: 'justify-self-end',
      stretch: 'justify-self-stretch',
    };

    const cyberItem = cyber
      ? 'border border-accent-primary/20 rounded-cyber shadow-[0_0_8px_rgba(0,243,255,0.2)] animate-[border-glow_3s_infinite]'
      : '';

    const orderClass = order ? `order-${order}` : '';

    return (
      <div
        ref={ref}
        className={`
          ${span ? spanClasses[span] : ''}
          ${start ? startClasses[start] : ''}
          ${end ? endClasses[end] : ''}
          ${rowSpan ? rowSpanClasses[rowSpan] : ''}
          ${alignSelfClasses[alignSelf]}
          ${justifySelfClasses[justifySelf]}
          ${orderClass}
          ${cyberItem}
          ${className || ''}
        `}
        role="gridcell"
        aria-colindex={start ? parseInt(start) : undefined}
        aria-rowindex={rowSpan ? 1 : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GridItem.displayName = 'GridItem';

export { Grid, GridItem };
