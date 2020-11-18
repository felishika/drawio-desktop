function SqlImport(editorui){

    //Table Info
    var foreignKeyList = [];
    var primaryKeyList = [];
    var tableList = [];
    var cells = [];
    var tableCell = null;
    var rowCell = null;
    var dx = 0;
    var exportedTables = 0;

    var edgeCells = [];
    var exCells = [];
    var exEdgeCells = [];

    function scanGraph(){
        const graph = editorui.editor.graph;
        var layers = graph.model.getChildCells(graph.model.root);
        if(layers.length !== 1){
            return;
        }

        scanChildren(layers[0]);
    }

    function scanChildren(cell) {
        const style = cell.getStyle();
        if(style != null && style.indexOf('PhysicalTable') != -1){
            exCells.push(cell);
            return;
        }
        
        if(style != null && style.indexOf('PhysicalEdge') != -1){
            exEdgeCells.push(cell);
        }

        if(cell.children == null || cell.children.length === 0){
            return;
        }

        cell.children.forEach(cell => scanChildren(cell));
    }

    function TableModel() {
        this.Name = null;
        this.Properties = []
    }

    
    function PropertyModel() {
        this.Name = null;
        this.DefaultValue = null;
        this.TableName = null;
        this.ForeignKey = [];
        this.PrimaryKey = null;
        this.IsPrimaryKey = false;
        this.IsForeignKey = false;
        this.NameWithType = null;
        
    }

    function ForeignKeyModel() {
        this.ForeignKeyPropertyName = null;
        this.ReferencesPropertyName = null

        this.ForeignKeyTableName = null;
        this.ReferencesTableName = null;

        this.ForeignKeyName = null;

        this.IsDestination = false;
    }

    function PrimaryKeyModel() {
        this.PrimaryKeyName = null;
        this.PrimaryKeyTableName = null;
        this.ConstraintName = null;
    }

    function CreateForeignKey(foreignKeyPropName, foreignKeyTableName, referencesPropertyName, referencesTableName, foreignKeyName, isDestination) {
        var foreignKey = new ForeignKeyModel;

        foreignKey.ForeignKeyTableName = foreignKeyTableName;
        foreignKey.ForeignKeyPropertyName = foreignKeyPropName;
        foreignKey.ReferencesPropertyName = referencesPropertyName;
        foreignKey.ReferencesTableName = referencesTableName;
        foreignKey.IsDestination = (isDestination !== undefined && isDestination !== null) ? isDestination : false;
        foreignKey.ForeignKeyName = foreignKeyName;

        return foreignKey;
    };

    function CreatePrimaryKey(primaryKeyName, primaryKeyTableName, constraintName) {
        var primaryKey = new PrimaryKeyModel;

        primaryKey.PrimaryKeyTableName = primaryKeyTableName;
        primaryKey.PrimaryKeyName = primaryKeyName;
        primaryKey.ConstraintName = constraintName;

        return primaryKey;
    };

    function ProcessPrimaryKey() {

        primaryKeyList.forEach(function(primaryModel) {
            tableList.forEach(function(tableModel) {
                if (tableModel.Name === primaryModel.PrimaryKeyTableName) {
                    tableModel.Properties.forEach(function(propertyModel) {
                        if (propertyModel.Name === primaryModel.PrimaryKeyName) {
                            propertyModel.IsPrimaryKey = true;
                            propertyModel.PrimaryKey = primaryModel;
                        }
                    });
                }
            });
        });
    }

    function AssignForeignKey(foreignKeyModel) {
        tableList.forEach(function(tableModel) {
            // if (tableModel.Name === foreignKeyModel.ReferencesTableName) {
            //     tableModel.Properties.forEach(function(propertyModel) {
            //         if (propertyModel.Name === foreignKeyModel.ReferencesPropertyName) {
            //             propertyModel.IsForeignKey = true;
            //             propertyModel.ForeignKey.push(foreignKeyModel);
            //         }
            //     });
            // }

            if (tableModel.Name === foreignKeyModel.ForeignKeyTableName) {
                tableModel.Properties.forEach(function(propertyModel) {
                    if (propertyModel.Name === foreignKeyModel.ForeignKeyPropertyName) {
                        propertyModel.IsForeignKey = true;
                        propertyModel.ForeignKey.push(foreignKeyModel);
                    }
                });
            }
        });
    }


    function AddRow(propertyModel, tableName) {

        var cellName = propertyModel.NameWithType;

        // if (propertyModel.IsForeignKey && propertyModel.ForeignKey !== undefined && propertyModel.ForeignKey !== null) {
        //     propertyModel.ForeignKey.forEach(function(foreignKeyModel) {

        //         //We do not want the foreign key to be duplicated in our table to the same property
        //         if (tableName !== foreignKeyModel.ForeignKeyTableName || (tableName === foreignKeyModel.ForeignKeyTableName && propertyModel.Name !== foreignKeyModel.PrimaryKeyName)) {
        //             cellName += ' | ' + foreignKeyModel.ForeignKeyTableName + '(' + foreignKeyModel.PrimaryKeyName + ')';
        //         }
        //     })
        // }

        rowCell = new mxCell(cellName, new mxGeometry(0, 0, 90, 26),
            'shape=partialRectangle;top=0;left=0;right=0;bottom=0;align=left;verticalAlign=top;spacingTop=-2;fillColor=none;spacingLeft=64;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;dropTarget=0;');
        rowCell.vertex = true;

        var columnType = propertyModel.IsPrimaryKey && propertyModel.IsForeignKey ? 'PK | FK' : propertyModel.IsPrimaryKey ? 'PK' : propertyModel.IsForeignKey ? 'FK' : '';

        var left = sb.cloneCell(rowCell, columnType);
        left.connectable = false;
        left.style = 'shape=partialRectangle;top=0;left=0;bottom=0;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=180;points=[];portConstraint=eastwest;part=1;'
        left.geometry.width = 54;
        left.geometry.height = 26;
        rowCell.insert(left);

        var size = editorui.editor.graph.getPreferredSizeForCell(rowCell);

        if (size !== null && tableCell.geometry.width < size.width + 10) {
            tableCell.geometry.width = size.width + 10;
        }

        tableCell.insert(rowCell);
        tableCell.geometry.height += 26;

        rowCell = rowCell;    

    };

    function ProcessForeignKey() {

        foreignKeyList.forEach(function(foreignKeyModel) {
            //Assign ForeignKey
            AssignForeignKey(foreignKeyModel);
        });
    }

    function parseForeignKey(name, currentTableModel){
        var referencesIndex = name.toLowerCase().indexOf("references");
        var addConstraintIndex = name.toLowerCase().indexOf("add constraint");
        var foreignKeyIndex = name.toLowerCase().indexOf("foreign key");

        if (name.toLowerCase().indexOf("foreign key(") !== -1) {
            var foreignKeySQL = name.substring(name.toLowerCase().indexOf("foreign key("), referencesIndex).replace("FOREIGN KEY(", '').replace(')', '');           
        } else {
            var foreignKeySQL = name.substring(name.toLowerCase().indexOf("foreign key ("), referencesIndex).replace("FOREIGN KEY (", '').replace(')', '');
        }

        var referencesSQL = name.substring(referencesIndex, name.length);
        var alterTableName = name.substring(11, addConstraintIndex).trim();
        var addConstraintSQL = name.substring(addConstraintIndex, foreignKeyIndex);

        if (referencesIndex !== -1 && alterTableName !== '' && foreignKeySQL !== '' && referencesSQL !== '') {

            //Remove references syntax
            referencesSQL = referencesSQL.replace("REFERENCES ", '');

            //Get Table and Property Index
            var referencedTableIndex = referencesSQL.indexOf("(");
            var referencedPropertyIndex = referencesSQL.indexOf(")");

            //Get Referenced Table
            var referencedTableName = referencesSQL.substring(0, referencedTableIndex);

            //Get Referenced Key
            var referencedPropertyName = referencesSQL.substring(referencedTableIndex + 1, referencedPropertyIndex);

            //Get ForeignKey 
            var foreignKey = foreignKeySQL.trim();

            //Get Constraint Name
            var fkName = addConstraintSQL.replace("ADD CONSTRAINT",'').trim();

            // //Create ForeignKey
            // var foreignKeyOriginModel = CreateForeignKey(foreignKey, alterTableName, referencedPropertyName, referencedTableName, fkName, true);

            // //Add ForeignKey Origin
            // foreignKeyList.push(foreignKeyOriginModel);            

            //Create ForeignKey
            var foreignKeyDestinationModel = CreateForeignKey(foreignKey, alterTableName, referencedPropertyName, referencedTableName, fkName, false);

            //Add ForeignKey Destination
            foreignKeyList.push(foreignKeyDestinationModel);
        }
    }

    function CreateTable(name) {
        var table = new TableModel;

        table.Name = name;

        //Count exported tables
        exportedTables++;

        return table;
    };

    function CreateProperty(name, tableName, foreignKey, isPrimaryKey, nameWithType) {
        var property = new PropertyModel;
        var isForeignKey = foreignKey !== undefined && foreignKey !== null;

        property.Name = name;
        property.TableName = tableName;
        property.ForeignKey = isForeignKey ? foreignKey : [];
        property.IsForeignKey = isForeignKey;
        property.IsPrimaryKey = isPrimaryKey;
        property.NameWithType = nameWithType;

        return property;
    };

    this.parseSql = function (text) {
        var lines = text.split('\n');
        dx = 0;
        
        tableCell = null;
        cells = [];
        exportedTables = 0;
        tableList = [];
        foreignKeyList = [];

        var currentTableModel = null;

        //Parse SQL to objects
        for (var i = 0; i < lines.length; i++) {

            rowCell = null;

            var tmp = mxUtils.trim(lines[i]);

            var propertyRow = tmp.substring(0, 12).toLowerCase();

            //Parse Table
            if (propertyRow === 'create table') {

                const brIndex = tmp.indexOf("(");
                const nameEndIndex = brIndex > 0 ? brIndex : tmp.length;
                //Parse row
                var name = mxUtils.trim(tmp.substring(12, nameEndIndex));

                if (currentTableModel !== null) {
                    //Add table to the list
                    tableList.push(currentTableModel);
                }

                //Create Table
                currentTableModel = CreateTable(name);
            }
            // Parse Properties 
            else if (tmp !== '(' && currentTableModel != null && propertyRow !== 'alter table ') {

                //Parse the row
                var name = tmp.substring(0, (tmp.charAt(tmp.length - 1) === ',') ? tmp.length - 1 : tmp.length);

                //Attempt to get the Key Type
                var propertyType = name.substring(0, 11).toLowerCase().trim();

                //Verify if this is a property that doesn't have a relationship (One minute of silence for the property)
                var normalProperty = propertyType !== 'constraint' && propertyType !== 'primary key' && propertyType !== 'foreign key' && propertyType !== 'constrain primary key' && propertyType !== 'constrain foreign key';

                //Parse properties that don't have relationships
                if (normalProperty) {

                    if (name === '' || name === "" || name === ");") {
                        continue;
                    }

                    var nameWithType = name;     

                    //Get delimiter of column name
                    var firstSpaceIndex = name.indexOf(' ');

                    //Get full name
                    name = name.substring(0, firstSpaceIndex);                                  

                    //Create Property
                    var propertyModel = CreateProperty(name, currentTableModel.Name, null, false, nameWithType);

                    //Add Property to table
                    currentTableModel.Properties.push(propertyModel);
                }

                //Parse Primary Key
                if (propertyType === 'constraint' || propertyType === 'primary key' || propertyType === 'constrain primary key') {
                    // if (!MODE_SQLSERVER) {
                        if(name.indexOf('CONSTRAINT') !== -1){
                            var constraintName = name.substring(11, name.indexOf('PRIMARY KEY')).trim();
                        }    

                        if(name.indexOf('PRIMARY KEY (') !== -1){
                            var primaryKey = name.substring(name.indexOf('PRIMARY KEY (')).replace('PRIMARY KEY (', '').replace(')', '');
                        } else if(name.indexOf('PRIMARY KEY(') !== -1){
                            var primaryKey = name.substring(name.indexOf('PRIMARY KEY(')).replace('PRIMARY KEY(', '').replace(')', '');
                        }
                        

                        //Create Primary Key
                        var primaryKeyModel = CreatePrimaryKey(primaryKey, currentTableModel.Name, constraintName);

                        //Add Primary Key to List
                        primaryKeyList.push(primaryKeyModel);

                    // } else {
                    //     var start = i + 2;
                    //     var end = 0;
                    //     if (name.indexOf('PRIMARY KEY') !== -1 && name.indexOf('CLUSTERED') === -1) {
                    //         var primaryKey = name.replace('PRIMARY KEY (', '').replace(')', '');

                    //         //Create Primary Key
                    //         var primaryKeyModel = CreatePrimaryKey(primaryKey, currentTableModel.Name);

                    //         //Add Primary Key to List
                    //         primaryKeyList.push(primaryKeyModel);

                    //     } else {
                    //         while (end === 0) {
                    //             var primaryKeyRow = mxUtils.trim(lines[start]);

                    //             if (primaryKeyRow.indexOf(')') !== -1) {
                    //                 end = 1;
                    //                 break;
                    //             }

                    //             start++;

                    //             primaryKeyRow = primaryKeyRow.replace("ASC", '');

                    //             //Create Primary Key
                    //             var primaryKeyModel = CreatePrimaryKey(primaryKeyRow, currentTableModel.Name);

                    //             //Add Primary Key to List
                    //             primaryKeyList.push(primaryKeyModel);
                    //         }
                    //     }

                    // }
                }

                // //Parse Foreign Key
                // if (propertyType === 'foreign key' || propertyType === 'constrain foreign key') {
                //     if (!MODE_SQLSERVER) {
                //         ParseMySQLForeignKey(name, currentTableModel);
                //     } else {
                //         var completeRow = name;

                //         if (name.indexOf('REFERENCES') === -1) {
                //             var referencesRow = mxUtils.trim(lines[i + 1]);
                //             completeRow = 'ALTER TABLE [dbo].[' + currentTableModel.Name + ']  WITH CHECK ADD' + ' ' + name + ' ' + referencesRow;
                //         }

                //         ParseSQLServerForeignKey(completeRow, currentTableModel);

                //     }
                // }

            } else if (propertyRow === 'alter table ') {

                //Parse the row
                var alterTableRow = tmp.substring(0, (tmp.charAt(tmp.length - 1) === ',') ? tmp.length - 1 : tmp.length);
                var referencesRow = mxUtils.trim(lines[i + 1]);
                var completeRow = alterTableRow + ' ' + referencesRow;

                parseForeignKey(completeRow, currentTableModel);
                
            }
        }

        //Add last table
        if (currentTableModel !== null) {
            //Add table to the list
            tableList.push(currentTableModel);
        }

        //Process Primary Keys
        ProcessPrimaryKey();

        //Process Foreign Keys
        ProcessForeignKey();

        // Collect existing table and edge cells;
        scanGraph();

        //Create Table in UI
        CreateTableUI();

        //Create Edge in UI
        CreateEdgeUI();

        //Combine tables and relations and crete full UI
        CreateFullUI();

        return true;
    };

    function createEdge(style, geometry){
        var edge = new mxCell('', new mxGeometry(0, 0, 0, 0), style);
            edge.geometry.setTerminalPoint(new mxPoint(geometry.x, geometry.y), true);
	        edge.geometry.setTerminalPoint(new mxPoint(geometry.x + geometry.width, geometry.height), false);
			edge.geometry.relative = true;
			edge.edge = true;
			
			if (geometry.x != null)
			{
		    	var cell1 = new mxCell(geometry.x, new mxGeometry(-1, 0, 0, 0), 'resizable=0;html=1;align=left;verticalAlign=bottom;');
		    	cell1.geometry.relative = true;
		    	cell1.setConnectable(false);
		    	cell1.vertex = true;
		    	edge.insert(cell1);
			}
			
			if (geometry.width != null)
			{
		    	var cell2 = new mxCell(geometry.width, new mxGeometry(1, 0, 0, 0), 'resizable=0;html=1;align=right;verticalAlign=bottom;');
		    	cell2.geometry.relative = true;
		    	cell2.setConnectable(false);
		    	cell2.vertex = true;
		    	edge.insert(cell2);
			}
			
			return edge;
    }

    function getEdgeGeometry(sourceGeometry, targetGeometry){
        if(sourceGeometry != null && targetGeometry != null){
            const sourceRight = sourceGeometry.x + sourceGeometry.width;
            const targetLeft = targetGeometry.x;
            
            const leftItem = sourceRight < targetLeft ? sourceGeometry : targetGeometry;
            const rightItem = sourceRight < targetLeft ? targetGeometry : sourceGeometry;

            const sourceBottom = sourceGeometry.y + sourceGeometry.height;
            const targetTop = targetGeometry.y;

            const topItem = sourceBottom < targetTop ? sourceGeometry: targetGeometry;
            const bottomItem = sourceBottom < targetTop ? targetGeometry: sourceGeometry;

            const x1 = leftItem.x + leftItem.width;
            const x2 = rightItem.x;

            const y1 = bottomItem.y;
            const y2 = topItem.y + topItem.height;

            return {x: x1, y: y1, width: Math.abs(x2-x1), height: Math.abs(y2-y1)}

        }
    
    }

    function edgeExists(fk){
        const {ForeignKeyPropertyName, ReferencesPropertyName, ForeignKeyName, isDestination, ForeignKeyTableName, ReferencesTableName,} = fk;

        const fkName = `FKName=${ForeignKeyName}`;
        const fkTableName = `FKTableName=${ForeignKeyTableName}`;
        const fKRefTableName = `FKRefTableName=${ReferencesTableName}`;
        const fkPropName = `FKPropName=${ForeignKeyPropertyName}`;
        const fKRefPropName = `FKRefPropName=${ReferencesPropertyName}`;
            

        exEdgeCells.some(cell => {const style = cell.getStyle();
            if(style != null && 
                (style.includes(fkName) && 
                 style.includes(fkTableName) &&
                 style.includes(fKRefTableName) &&
                 style.includes(fkPropName) &&
                 style.includes(fKRefPropName))){
                
                    return true;
            }
            
            return false;})
        
    }

    function tableExists(table) {
        return exCells.some(cell => {
            return cell.value === table.Name;
        });
    }

    function CreateEdgeUI(){
        foreignKeyList.forEach(foreignKey => {

            const {ForeignKeyPropertyName, ReferencesPropertyName, ForeignKeyName, isDestination, ForeignKeyTableName, ReferencesTableName,} = foreignKey;
            const hasEdge = edgeExists(foreignKey); 
            if(!hasEdge){
                const source = cells.find(cell => cell.value === ReferencesTableName);            
                const target = cells.find(cell => cell.value === ForeignKeyTableName); 
    
                const sourceGeometry = source?.geometry;
                const targetGeometry = target?.geometry;
    
                const edgeGeometry = getEdgeGeometry(sourceGeometry, targetGeometry);
                const addStyles = `FKName=${ForeignKeyName};FKTableName=${ForeignKeyTableName};FKRefTableName=${ReferencesTableName};FKPropName=${ForeignKeyPropertyName};FKRefPropName=${ReferencesPropertyName};PhysicalEdge=true;`;
                
                
    
                const edge = createEdge(`edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERoneToMany;${addStyles}`, edgeGeometry)
                edgeCells.push(edge);
            }
            
        })

        // if (edgeCells.length > 0) {
        //     var graph = editorui.editor.graph;
        //     var view = graph.view;
        //     var bds = graph.getGraphBounds();

        //     // Computes unscaled, untranslated graph bounds
        //     var x = Math.ceil(Math.max(0, bds.x / view.scale - view.translate.x) + 4 * graph.gridSize);
        //     var y = Math.ceil(Math.max(0, (bds.y + bds.height) / view.scale - view.translate.y) + 4 * graph.gridSize);

        //     graph.setSelectionCells(graph.importCells(edgeCells, x, y));
        //     graph.scrollCellToVisible(graph.getSelectionCell());
        // }  
    }

    function CreateTableUI() {

        tableList.forEach(function(tableModel) {
            const hasTable = tableExists(tableModel);
            if(!hasTable){
            //Define table size width
            var maxNameLenght = 100 + tableModel.Name.length;

            const pkProp = tableModel.Properties.find(prop => prop.IsPrimaryKey);
            const pkModel = pkProp?.PrimaryKey;
            const pkName = pkModel?.ConstraintName;
            const pkConstraintStyle = pkName ? `PKConstraintName=${pkName}` : '';

            const addStyle = `PhysicalTable=true;${pkConstraintStyle};`;
            //Create Table
            tableCell = new mxCell(tableModel.Name, new mxGeometry(dx, 0, maxNameLenght, 26),
                'swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;' +
                'fillColor=#e0e0e0;horizontalStack=0;resizeParent=1;resizeLast=0;' +
                'collapsible=1;marginBottom=0;swimlaneFillColor=#ffffff;align=center;' + 
                addStyle);
            tableCell.vertex = true;

            //Resize row
            var size = editorui.editor.graph.getPreferredSizeForCell(rowCell);
            if (size !== null) {
                tableCell.geometry.width = size.width + maxNameLenght;
            }

            //Add Table to cells
            cells.push(tableCell);

            //Add properties
            tableModel.Properties.forEach(function(propertyModel) {

                //Add row
                AddRow(propertyModel, tableModel.Name);
            });

            //Close table
            dx += tableCell.geometry.width + 40;

            tableCell = null;
            }
        });
                
    };

    function CreateFullUI() {
        const allCells = [...cells, ...edgeCells];

        if (allCells.length > 0) {
            var graph = editorui.editor.graph;
            var view = graph.view;
            var bds = graph.getGraphBounds();

            // Computes unscaled, untranslated graph bounds
            var x = Math.ceil(Math.max(0, bds.x / view.scale - view.translate.x) + 4 * graph.gridSize);
            var y = Math.ceil(Math.max(0, (bds.y + bds.height) / view.scale - view.translate.y) + 4 * graph.gridSize);

            graph.setSelectionCells(graph.importCells(allCells, x, y));
            graph.scrollCellToVisible(graph.getSelectionCell());
        }
    }
    
}