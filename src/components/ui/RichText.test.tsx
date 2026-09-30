// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

describe('RichText', () => {
  it('shows the formatted text the API sent', () => {
    render(<RichText value={{ html: '<p>Gentle <strong>cleanser</strong></p><ul><li>200 ml</li></ul>' }} data-testid="description" />);

    const box = screen.getByTestId('description');
    expect(box.querySelector('strong')?.textContent).toBe('cleanser');
    expect(box.querySelectorAll('li')).toHaveLength(1);
  });

  it('renders nothing without a value', () => {
    const { container } = render(<RichText value={null} />);
    expect(container.childElementCount).toBe(0);
  });
});
