import type { Meta, StoryObj } from '@storybook/react';
import { Grid, GridItem } from '../Grid';
import { Card } from '../Card';

const meta = {
  title: 'Components/Layout/Grid',
  component: Grid,
  subcomponents: { GridItem },
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    columns: '3',
    gap: 'md',
  },
  argTypes: {
    columns: {
      options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'auto', 'fr'],
      control: { type: 'select' },
    },
    gap: {
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
      control: { type: 'radio' },
    },
    align: {
      options: ['start', 'center', 'end', 'stretch'],
      control: { type: 'radio' },
    },
    justify: {
      options: ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'],
      control: { type: 'radio' },
    },
    cyber: {
      control: { type: 'boolean' },
    },
    glitchEffect: {
      control: { type: 'boolean' },
    },
  },
} as Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof Grid>;

export const Default: Story = {
  args: {
    children: (
      <GridItem>
        <Card title="Item 1">Grid item content</Card>
      </GridItem>
    ),
  },
};

export const GridItems: Story = {
  args: {
    children: (
      <>
        <GridItem span="4">
          <Card title="Item 1">Wide item spanning 4 columns</Card>
        </GridItem>
        <GridItem span="4">
          <Card title="Item 2">Medium item</Card>
        </GridItem>
        <GridItem span="4">
          <Card title="Item 3">Medium item</Card>
        </GridItem>
        <GridItem span="6">
          <Card title="Item 4">Wide item spanning 6 columns</Card>
        </GridItem>
        <GridItem span="6">
          <Card title="Item 5">Medium item</Card>
        </GridItem>
      </>
    ),
  },
};

export const CyberGrid: Story = {
  args: {
    cyber: true,
    children: (
      <>
        <GridItem cyber>
          <Card title="Item 1" variant="cyber">Cyber grid item</Card>
        </GridItem>
        <GridItem cyber>
          <Card title="Item 2" variant="cyber">Cyber grid item</Card>
        </GridItem>
        <GridItem cyber>
          <Card title="Item 3" variant="cyber">Cyber grid item</Card>
        </GridItem>
      </>
    ),
  },
};

export const Responsive: Story = {
  args: {
    columns: 'auto',
    gap: 'lg',
    children: (
      <>
        <GridItem>
          <Card title="Responsive 1">First responsive item</Card>
        </GridItem>
        <GridItem>
          <Card title="Responsive 2">Second responsive item</Card>
        </GridItem>
        <GridItem>
          <Card title="Responsive 3">Third responsive item</Card>
        </GridItem>
      </>
    ),
  },
};

export const CustomGrid: Story = {
  args: {
    gap: 'none',
    children: (
      <>
        <GridItem rowSpan="2">
          <Card title="Tall Item" padding="lg">Tall grid item spanning 2 rows</Card>
        </GridItem>
        <GridItem>
          <Card title="Short 1">Short item</Card>
        </GridItem>
        <GridItem>
          <Card title="Short 2">Short item</Card>
        </GridItem>
        <GridItem>
          <Card title="Short 3">Short item</Card>
        </GridItem>
      </>
    ),
  },
};

export const Alignments: Story = {
  args: {
    align: 'center',
    justify: 'center',
    gap: 'md',
    children: (
      <>
        <GridItem>
          <Card title="Centered 1">Centered content</Card>
        </GridItem>
        <GridItem>
          <Card title="Centered 2">Centered content</Card>
        </GridItem>
        <GridItem>
          <Card title="Centered 3">Centered content</Card>
        </GridItem>
      </>
    ),
  },
};

export const Justified: Story = {
  args: {
    justify: 'space-between',
    gap: 'sm',
    children: (
      <>
        <GridItem>
          <Card title="Justified 1">Spaced item</Card>
        </GridItem>
        <GridItem>
          <Card title="Justified 2">Spaced item</Card>
        </GridItem>
        <GridItem>
          <Card title="Justified 3">Spaced item</Card>
        </GridItem>
      </>
    ),
  },
};
