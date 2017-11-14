﻿import * as PropTypes from "prop-types";
import * as React from "react";
import "reflect-metadata";

import { Store } from "listick";

/**
 * Describes react component class where additionally services
 * are defined as input arguments.
 */
export interface ConnectComponentClass<P = {}>
{
	new (props: P, context: any, ...services: any[]): React.Component<P, {}>;
}

export interface ConnectClassDecorator<TProps>
{
	<T extends ConnectComponentClass<TProps>>(target: T): T;
}

/**
 * Connect React component with Listick Store. 
 * @param stateGet Callback that extract required state from store.
 */
export function connect<TProps, TState>(stateGet: (store: any) => TState): ConnectClassDecorator<TProps>
{

	let subscribedFunction: (sender: any, args: any)=> void;

	return <T extends ConnectComponentClass<TProps>>(target: T): T =>
	{
		// Here we override real rect component with new one.
		// For this new constructor is defined and prototype copied to new object.
		let store: Store<any>;
		const inputArgs: any[] = Reflect.getMetadata("design:paramtypes", target);
		function constructorOverride(props: TProps, context: any, pThis: any)
		{
			// Collect all services requested by constructor.
			const requestedServices: any[] = [];
			store = context.store as Store<any>;
			for (let i = 2; i < inputArgs.length; i++)
			{
				const service = store.getService(inputArgs[i]);
				if (service === undefined)
				{
					console.error(`Service ${inputArgs[i]} is not registered in store`);
				}

				requestedServices.push(service);
			}
			const targetArgs: any[] = [
				props,
				context,
				...requestedServices
			];
			target.apply(pThis, targetArgs);
			pThis.state = stateGet(store.getStoreState());
		}

		// Have to use this hack to make new class name the same as original.
		// For now there is no other way.
		const connector = new Function(
			"constructorOverride",
			`return function ${target.name} (props, context) \
				{ \
					return constructorOverride(props, context, this); \
				}`)(constructorOverride);
		connector.prototype = Object.create(target.prototype);

		// We need to listen to state change only when component is mounted.
		connector.prototype.componentDidMount = function()
		{
			subscribedFunction = (sender: any, args: any) =>
			{
				this.setState(stateGet(store.getStoreState()));
			};
			store.stateChanged.add(subscribedFunction)
		};
		connector.prototype.componentWillUnmount = function()
		{
			store.stateChanged.remove(subscribedFunction);
		};
		connector.contextTypes = {
			store: PropTypes.object.isRequired
		}

		return connector as T;
	}
}