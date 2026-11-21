import { Outlet } from "react-router";

/** The Lists tab and a single list share the page width, so this level only passes through. */
const ListsLayout = () => <Outlet />;

export default ListsLayout;
