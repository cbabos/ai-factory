import { describe, it, expect } from 'vitest';
import { Grid, GridItem } from '../Grid';

describe('Grid', () => {
  it('has Grid component', () => {
    expect(Grid).toBeDefined();
  });

  it('has GridItem component', () => {
    expect(GridItem).toBeDefined();
  });
});

describe('GridItem', () => {
  it('renders GridItem component', () => {
    const gridItem = <GridItem span="3" />;
    expect(gridItem).toBeDefined();
  });
});
