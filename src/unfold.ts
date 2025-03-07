/* eslint-disable @typescript-eslint/ban-ts-comment */

import { toArray } from '@lumino/algorithm';

import { PromiseDelegate, ReadonlyJSONObject } from '@lumino/coreutils';

import { DOMUtils } from '@jupyterlab/apputils';

import { JupyterFrontEnd } from '@jupyterlab/application';

import { Contents, ContentsManager } from '@jupyterlab/services';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { PathExt } from '@jupyterlab/coreutils';

import {
  DirListing,
  FileBrowser,
  FilterFileBrowserModel
} from '@jupyterlab/filebrowser';

import { ITranslator } from '@jupyterlab/translation';

import { classes, LabIcon } from '@jupyterlab/ui-components';

import { IStateDB } from '@jupyterlab/statedb';

// @ts-ignore
import folderOpenSvgstr from '../style/icons/folder-open.svg';

export const folderOpenIcon = new LabIcon({
  name: 'ui-components:folder-open',
  svgstr: folderOpenSvgstr
});

/**
 * The namespace for the `FileTreeBrowser` class statics.
 */
export namespace FileTreeBrowser {
  /**
   * An options object for initializing a file tree browser widget.
   */
  export interface IOptions extends FileBrowser.IOptions {
    /**
     * A file browser model instance.
     */
    model: FilterFileTreeBrowserModel;

    /**
     * The JupyterFrontEnd app.
     */
    app: JupyterFrontEnd;
  }
}

/**
 * The namespace for the `DirTreeListing` class statics.
 */
export namespace DirTreeListing {
  /**
   * An options object for initializing a file tree listing widget.
   */
  export interface IOptions extends DirListing.IOptions {
    /**
     * A file browser model instance.
     */
    model: FilterFileTreeBrowserModel;
  }
}

/**
 * The namespace for the `FilterFileTreeBrowserModel` class statics.
 */
export namespace FilterFileTreeBrowserModel {
  /**
   * An options object for initializing a file tree listing widget.
   */
  export interface IOptions extends FilterFileBrowserModel.IOptions {
    /**
     * The JupyterFrontEnd app.
     */
    app: JupyterFrontEnd;
  }
}

/**
 * The namespace for the `FileTreeBrowser` class statics.
 */
export namespace FileTreeBrowser {
  /**
   * An options object for initializing a file tree browser widget.
   */
  export interface IOptions extends FileBrowser.IOptions {
    /**
     * A file browser model instance.
     */
    model: FilterFileTreeBrowserModel;
  }
}

/**
 * A filetree renderer.
 */
export class FileTreeRenderer extends DirListing.Renderer {
  constructor(model: FilterFileTreeBrowserModel) {
    super();

    this.model = model;
  }

  /**
   * Create the DOM node for a dir listing.
   */
  createNode(): HTMLElement {
    const node = document.createElement('div');
    const content = document.createElement('ul');
    content.className = 'jp-DirListing-content';
    node.appendChild(content);
    node.tabIndex = 1;
    return node;
  }

  populateHeaderNode(
    node: HTMLElement,
    translator?: ITranslator,
    hiddenColumns?: Set<DirListing.ToggleableColumn>
  ): void {
    // No-op we don't want any header
  }

  handleHeaderClick(
    node: HTMLElement,
    event: MouseEvent
  ): DirListing.ISortState | null {
    return null;
  }

  updateItemNode(
    node: HTMLElement,
    model: Contents.IModel,
    fileType?: DocumentRegistry.IFileType,
    translator?: ITranslator,
    hiddenColumns?: Set<DirListing.ToggleableColumn>
  ): void {
    super.updateItemNode(node, model, fileType, translator, hiddenColumns);

    if (model.type === 'directory' && this.model.isOpen(model)) {
      const iconContainer = DOMUtils.findElement(
        node,
        'jp-DirListing-itemIcon'
      );

      LabIcon.resolveElement({
        icon: folderOpenIcon,
        iconClass: classes('jp-Icon'),
        container: iconContainer,
        className: 'jp-DirListing-itemIcon',
        stylesheet: 'listing'
      });
    }

    // Removing old vbars
    while (
      node.firstChild !== null &&
      (node.firstChild as HTMLElement).classList.contains('jp-DirListing-vbar')
    ) {
      node.removeChild(node.firstChild);
    }

    // Adding vbars for subdirs
    for (let n = 0; n < model.path.split('/').length - 1; n++) {
      const vbar = document.createElement('div');
      vbar.classList.add('jp-DirListing-vbar');
      node.insertBefore(vbar, node.firstChild);
    }
  }

  private model: FilterFileTreeBrowserModel;
}

/**
 * A widget which hosts a filetree.
 */
export class DirTreeListing extends DirListing {
  constructor(options: DirTreeListing.IOptions) {
    super({ ...options, renderer: new FileTreeRenderer(options.model) });
  }

  get headerNode(): HTMLElement {
    return document.createElement('div');
  }

  sort(state: DirListing.ISortState): void {
    // @ts-ignore
    this._sortedItems = toArray(this.model.items());
    // @ts-ignore
    this._sortState = state;
    this.update();
  }

  get model(): FilterFileTreeBrowserModel {
    // @ts-ignore
    return this._model;
  }

  protected handleOpen(item: Contents.IModel): void {
    if (item.type === 'directory') {
      this.model.toggle(item.path);
    } else {
      super.handleOpen(item);
    }
  }

  protected async handleFileSelect(event: MouseEvent): Promise<void> {
    super.handleFileSelect(event);

    if (Object.keys(this.selection).length === 1) {
      const selection = Object.keys(this.selection)[0];

      const isDirectory = await this.model.isDirectory(selection);

      if (isDirectory) {
        this.model.path = '/' + selection;
      } else {
        this.model.path = '/' + PathExt.dirname(selection);
      }
    }
  }
}

/**
 * Filetree browser model with optional filter on element.
 */
export class FilterFileTreeBrowserModel extends FilterFileBrowserModel {
  constructor(options: FilterFileTreeBrowserModel.IOptions) {
    super(options);

    this.app = options.app;
    this.contentManager = this.app.serviceManager.contents;
    this.basePath = '.';

    this._savedState = options.state || null;
  }

  get path(): string {
    return this._path;
  }

  set path(value: string) {
    this._path = value;
  }

  async isDirectory(path: string): Promise<boolean> {
    const entry = await this.contentManager.get(path);

    return entry.type === 'directory';
  }

  /**
   * Change directory.
   *
   * @param path - The path to the file or directory.
   *
   * @returns A promise with the contents of the directory.
   */
  async cd(pathToUpdate = '.'): Promise<void> {
    const result = await this.fetchContent(this.basePath, pathToUpdate);

    // @ts-ignore
    this.handleContents({
      name: '.',
      path: '.',
      type: 'directory',
      content: result
    });

    if (this._savedState && this._stateKey) {
      void this._savedState.save(this._stateKey, { openState: this.openState });
    }

    this.onRunningChanged(
      this.manager.services.sessions,
      this.manager.services.sessions.running()
    );
  }

  /**
   * A promise that resolves when the model is first restored.
   */
  get restored(): Promise<void> {
    return this._isRestored.promise;
  }

  /**
   * Restore the state of the file browser.
   *
   * @param id - The unique ID that is used to construct a state database key.
   *
   * @param populate - If `false`, the restoration ID will be set but the file
   * browser state will not be fetched from the state database.
   *
   * @returns A promise when restoration is complete.
   *
   * #### Notes
   * This function will only restore the model *once*. If it is called multiple
   * times, all subsequent invocations are no-ops.
   */
  async restore(id: string, populate = true): Promise<void> {
    const { manager } = this;
    const key = `file-browser-${id}:openState`;
    const state = this._savedState;
    const restored = !!this._stateKey;

    if (restored) {
      return;
    }

    // Set the file browser key for state database fetch/save.
    this._stateKey = key;

    if (!populate || !state) {
      this._isRestored.resolve(undefined);
      return;
    }

    await manager.services.ready;

    try {
      const value = await state.fetch(key);

      if (!value) {
        await this.cd('.');
        this._isRestored.resolve(undefined);
        return;
      }

      this.openState = (value as ReadonlyJSONObject)['openState'] as {
        [path: string]: boolean;
      };
      await this.cd('.');
    } catch (error) {
      await this.cd('.');
      await state.remove(key);
    }

    this._isRestored.resolve(undefined);
  }

  /**
   * Open/close directories to discover/hide a given path.
   *
   * @param pathToToggle - The path to discover/hide.
   */
  async toggle(pathToToggle = '.'): Promise<void> {
    this.openState[pathToToggle] = !this.openState[pathToToggle];

    // Refresh
    this.cd('.');
  }

  /**
   * Check whether a directory entry is open or not.
   *
   * @param model - The given entry.
   *
   * @returns Whether the directory is open or not.
   *
   */
  isOpen(model: Contents.IModel): boolean {
    return !!this.openState[model.path];
  }

  private async fetchContent(
    path: string,
    pathToUpdate?: string
  ): Promise<Contents.IModel[]> {
    const result = await this.contentManager.get(path);

    let items: Contents.IModel[] = [];

    const sortedContent = this.sortContents(result.content);

    this.openState[path] = true;

    for (const entry of sortedContent) {
      items.push(entry);

      if (entry.type !== 'directory') {
        continue;
      }

      const isOpen =
        (pathToUpdate && pathToUpdate.startsWith('/' + entry.path)) ||
        this.isOpen(entry);

      if (isOpen) {
        const subEntryContent = await this.fetchContent(
          entry.path,
          pathToUpdate
        );

        items = items.concat(subEntryContent);
      } else {
        this.openState[entry.path] = false;
      }
    }

    return items;
  }

  /**
   * Sort the entries
   *
   * @param data: The entries to sort
   * @returns the sorted entries
   */
  private sortContents(data: Contents.IModel[]): Contents.IModel[] {
    const directories = data.filter(value => value.type === 'directory');
    const files = data.filter(value => value.type !== 'directory');

    const sortedDirectories = directories.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));

    return sortedDirectories.concat(sortedFiles);
  }

  protected onFileChanged(
    sender: Contents.IManager,
    change: Contents.IChangedArgs
  ): void {
    this.refresh();
  }

  private _isRestored = new PromiseDelegate<void>();
  private _savedState: IStateDB | null = null;
  private _stateKey: string | null = null;
  private _path: string = '.';
  private basePath: string;
  private contentManager: ContentsManager;
  private app: JupyterFrontEnd;
  private openState: { [path: string]: boolean } = {};
}

/**
 * The filetree browser.
 */
export class FileTreeBrowser extends FileBrowser {
  constructor(options: FileTreeBrowser.IOptions) {
    super(options);

    this.layout.removeWidget(this.crumbs);

    this.showLastModifiedColumn = false;
  }

  get showLastModifiedColumn(): boolean {
    return false;
  }

  set showLastModifiedColumn(value: boolean) {
    if (this.listing.setColumnVisibility) {
      this.listing.setColumnVisibility('last_modified', false);
    }
  }

  protected createDirListing(options: DirListing.IOptions): DirListing {
    return new DirTreeListing({
      model: this.model,
      translator: this.translator
    });
  }

  set useFuzzyFilter(value: boolean) {
    // No-op
  }

  model: FilterFileTreeBrowserModel;
}
