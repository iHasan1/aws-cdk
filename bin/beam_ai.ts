#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BeamAiStack } from '../lib/beam_ai-stack';

const app = new cdk.App();
new BeamAiStack(app, 'BeamAiStack', {
    env: {
        account: '503470143287',
        region: 'us-east-1'
    }
});
