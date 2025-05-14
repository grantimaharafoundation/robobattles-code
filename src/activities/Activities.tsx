// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2023 The Pybricks Authors

import './activities.scss';
import React from 'react';
import Explorer from '../explorer/Explorer';

/**
 * React component that acts as a tab control to select activities.
 */
const Activities: React.FunctionComponent = () => {
    return (
        <div className="pb-activities-tabview">
            <Explorer />
        </div>
    );
};

export default Activities;
