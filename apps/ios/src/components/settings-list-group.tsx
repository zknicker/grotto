import { ListGroup } from 'heroui-native/list-group';
import { Separator } from 'heroui-native/separator';
import { Children, Fragment, isValidElement, type PropsWithChildren } from 'react';

export function SettingsListGroup({ children }: PropsWithChildren) {
    const items = Children.toArray(children);

    return (
        <ListGroup>
            {items.map((item, index) => (
                <Fragment key={isValidElement(item) && item.key !== null ? item.key : index}>
                    {index > 0 ? <Separator className="mr-4 ml-12" /> : null}
                    {item}
                </Fragment>
            ))}
        </ListGroup>
    );
}
