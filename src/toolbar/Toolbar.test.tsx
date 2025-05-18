// SPDX-License-Identifier: MIT
// Copyright (c) 2022 The Pybricks Authors

import React from 'react';
import { testRender } from '../../test';
import Toolbar from './Toolbar';

describe('toolbar', () => {
    it('should have bluetooth button', () => {
        const [, toolbar] = testRender(<Toolbar />);

        const runButton = toolbar.getByRole('button', { name: 'Bluetooth' });

        expect(runButton).toBeDefined();
    });

    it('should have run button', () => {
        const [, toolbar] = testRender(<Toolbar />);

        const runButton = toolbar.getByRole('button', { name: 'Run' });

        expect(runButton).toBeDefined();
    });
});
