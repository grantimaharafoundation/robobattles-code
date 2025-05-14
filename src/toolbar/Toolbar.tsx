// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2023 The Pybricks Authors

import { ButtonGroup } from '@blueprintjs/core';
import React from 'react';
import { Toolbar as UtilsToolbar } from '../components/toolbar/Toolbar';
import BluetoothButton from './buttons/bluetooth/BluetoothButton';
import RunButton from './buttons/run/RunButton';
import { useI18n } from './i18n';

import './toolbar.scss';

// matches ID in tour component
const bluetoothButtonId = 'pb-toolbar-bluetooth-button';
const runButtonId = 'pb-toolbar-run-button';

const Toolbar: React.FunctionComponent = () => {
    const i18n = useI18n();

    return (
        <UtilsToolbar
            aria-label={i18n.translate('label')}
            className="pb-toolbar"
            firstFocusableItemId={bluetoothButtonId}
        >
            <ButtonGroup className="pb-toolbar-group pb-align-left">
                <BluetoothButton id={bluetoothButtonId} />
            </ButtonGroup>
            <ButtonGroup className="pb-toolbar-group pb-align-left">
                <RunButton id={runButtonId} />
            </ButtonGroup>
        </UtilsToolbar>
    );
};

export default Toolbar;
