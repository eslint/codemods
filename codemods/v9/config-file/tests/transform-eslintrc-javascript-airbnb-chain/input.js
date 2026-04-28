'use strict';

const airbnbBase = require('eslint-config-airbnb-base');

// eslint-disable-next-line import/no-dynamic-require
const bestPractices = require(airbnbBase.extends[0]);

const ignoredProps = bestPractices.rules[
    'no-param-reassign'
][1].ignorePropertyModificationsFor.concat(
    'err',
    'x',
);

const additionalChanges = {
    'no-param-reassign': [
        'error',
        {
            props: true,
            ignorePropertyModificationsFor: ignoredProps,
        },
    ],
};

module.exports = {
    env: {
        node: true,
    },
    ignorePatterns: ['dist'],
    extends: ['eslint:recommended', 'airbnb-base', 'plugin:prettier/recommended'],
    plugins: ['prettier'],
    rules: {
        ...additionalChanges,
    },
};
