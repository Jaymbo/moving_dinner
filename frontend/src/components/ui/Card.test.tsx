import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardSection } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello World</Card>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies no-padding class when padding is none', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    expect(container.firstChild).toHaveClass('ui-card-no-padding');
  });
});

describe('CardHeader', () => {
  it('renders title and subtitle', () => {
    render(<CardHeader title="Title" subtitle="Subtitle" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });
});

describe('CardSection', () => {
  it('renders children', () => {
    render(<CardSection>Section Content</CardSection>);
    expect(screen.getByText('Section Content')).toBeInTheDocument();
  });
});
