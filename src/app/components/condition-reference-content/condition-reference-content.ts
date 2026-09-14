import { Component, Input } from '@angular/core';
import type { ConditionReference } from '../../models/condition-reference-model';

@Component({ selector: 'app-condition-reference-content', standalone: true, templateUrl: './condition-reference-content.html' })
export class ConditionReferenceContentComponent { @Input({ required: true }) condition!: ConditionReference; }
