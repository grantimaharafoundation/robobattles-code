// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2023 The Pybricks Authors

import { cleanup, screen } from '@testing-library/react';
import React from 'react';
import { testRender } from '../../test';
import Activities from './Activities';

// Mock the Explorer component as its internal details are not relevant for this test.
// We only care that Activities renders it.
jest.mock('../explorer/Explorer', () => {
    return {
        __esModule: true,
        default: () => <div data-testid="mock-explorer" />,
    };
});

afterEach(() => {
    cleanup();
    jest.resetAllMocks();
});

describe('Activities', () => {
    it('should render the Explorer component', () => {
        testRender(<Activities />);
        expect(screen.getByTestId('mock-explorer')).toBeInTheDocument();
    });
});
